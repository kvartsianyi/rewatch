import * as cheerio from 'cheerio';
import axios from 'axios';
import path from 'node:path';

import { Recorder } from './recorder.js';
import {
	log,
	writeToLog,
	getOutputFilePattern,
} from './utils.js';
import CONFIG from './config.js';

const {
	OUTPUT_FOLDER_PATH,
	FFMPEG_LOG_PATH,
	FFMPED_CRITICAL_WARNINGS,
	DEBUG,
} = CONFIG;

// <script id="SIGI_STATE" type="application/json"></script>
const DEFAULT_HEADERS = {
	Connection: 'keep-alive',
	'Cache-Control': 'max-age=0',
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36',
	Accept: 'text/html,application/json,application/protobuf',
	Referer: 'https://www.tiktok.com/',
	Origin: 'https://www.tiktok.com',
	'Accept-Language': 'en-US,en;q=0.9',
	'Accept-Encoding': 'gzip, deflate',
};
const URL_WEB_LIVE = "https://www.tiktok.com/@{channel}/live";
// const STATUS_OFFLINE = 4;
const STATUSES = {
  LIVE: 2,
};

// 0 - Error or Inactive stream.
// 1 - Stream Starting or Preparing (the stream is not yet live but in the setup phase).
// 2 - Live
// 3 - Temporarily Suspended (for streams interrupted, often due to network issues).
// 4 - Offline
// 5 - Ended (Something like terminated or due to technical issues)
// 6 - Banned or Restricted (usually the result of violations during the stream, leading to a ban).

// const channel = 'angelica88884';
// const channel = 'kudriava_malyshka';

export class TiktokParser {
  #axios;

  constructor() {
    this.#axios = axios;
  }

  async getTtStreamUrl(channel) {
    const liveRoomInfo = await this.#getLiveRoomDetails(channel);
  
    if (!liveRoomInfo) {
      return null;
    }
  
    const streams = this.#parseStreams(liveRoomInfo.streamData);
  
    return this.#findBestStreamQualityUrl(streams);
  }

  async #getLiveRoomDetails(channel) {
    try {
      const liveUrl = URL_WEB_LIVE.replace("{channel}", channel);
      const response = await this.#axios.get(liveUrl, {
        headers: DEFAULT_HEADERS,
      });
      const pageHtml = response?.data;
  
      const $ = cheerio.load(pageHtml);
      const sigiScript = $('#SIGI_STATE')?.html();
  
      if (!sigiScript) throw new Error('Can\'t find #SIGI_STATE');
      
      const sigiState = JSON.parse(sigiScript);
      const ttUser = sigiState?.LiveRoom?.liveRoomUserInfo?.user;
      const roomId = sigiState?.LiveRoom?.liveRoomUserInfo?.user?.roomId;
      const liveRoomInfo = sigiState?.LiveRoom?.liveRoomUserInfo?.liveRoom;
  
      if (liveRoomInfo.status !== STATUSES.LIVE) {
        return null;
      }
  
      return liveRoomInfo;
    } catch (error) {
      console.error("Error fetching live room details:", error);
      return null;
    }
  }

  #parseStreams(streamData) {
    const { stream_data } = streamData?.pull_data;
  
    return JSON.parse(stream_data)?.data;
  }
  
  #findBestStreamQualityUrl(streams, type = 'flv') {
    return streams?.origin?.main?.[type];
  }
}

// TODO: Make it properly
const channel_ = 'angelica88884';

const parser = new TiktokParser();
const stream = await parser.getTtStreamUrl(channel_);
if (stream)
  console.log(stream);

export class TiktokRecorder {
	#recorder;
	#parser;
  channel;

	constructor(options) {
    this.#parser = new TiktokParser();
		this.#recorder = new Recorder()
      .init({
        onStartCallback: this.#startCallback.bind(this),
        onEndCallback: options?.endCallback || this.#endCallback.bind(this),
        onErrorCallback: this.#errorCallback.bind(this),
        onStdoutCallback: this.#stdoutCallback.bind(this),
      });
	}

  async handleStreamRecording(channel) {
    try {
      this.channel = channel;
      const streamUrl = await this.#parser.getTtStreamUrl(this.channel);
		
      if (!streamUrl) {
        return null;
      }

      const outputPath = this.#generateOutputPath(this.channel);

      this.startRecording(streamUrl, outputPath);

      return streamUrl;
    } catch (e) {
      log('An error during "handleStreamRecording" process', e);
    }
  }

  startRecording(input, output) {
    return this.#recorder.run(input, output);
  }

  async stopRecording() {
    return this.#recorder.gracefulShutdown();
  }

  #generateOutputPath() {
    return path.resolve(OUTPUT_FOLDER_PATH, getOutputFilePattern(this.channel));
  }

	#startCallback() {
    log(`Channel ${this.channel}. Recording started...`);
  }

  #endCallback() {
    log(`Channel ${this.channel}. Recording finished...`);
    this.channel = null;
  }

  #errorCallback(err, stdout, stderr) {
    log(`Channel ${this.channel}. Error during recording:`, err);
    log(`Ffmpeg stdout:`, stdout);
    log(`Ffmpeg stderr:`, stderr);
  }

  async #stdoutCallback(stdoutLine) {
    if (DEBUG === 'ffmpeg') {
				await writeToLog(FFMPEG_LOG_PATH, stdoutLine);
			}

    const isCriticalWarning = FFMPED_CRITICAL_WARNINGS
      .some(warning => stdoutLine.includes(warning));
    if (isCriticalWarning) {
      await this.gracefulShutdown();
    }
  }
}
