import * as cheerio from 'cheerio';
import axios from 'axios';
import path from 'node:path';

import { Recorder } from './recorder.js';
import CONFIG from './config.js';
import {
	log,
	writeToLog,
	getOutputFilePattern,
} from './utils.js';

const {
	OUTPUT_FOLDER_PATH,
	FFMPEG_LOG_PATH,
	FFMPED_CRITICAL_WARNINGS,
  TT_HEADERS,
	URL_WEB_LIVE,
	LIVE_STATUS,
	DEBUG,
} = CONFIG;

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
        headers: TT_HEADERS,
      });
      const pageHtml = response?.data;
  
      const $ = cheerio.load(pageHtml);
      const sigiScript = $('#SIGI_STATE')?.html();
  
      if (!sigiScript) throw new Error('Can\'t find #SIGI_STATE');
      
      const sigiState = JSON.parse(sigiScript);
      if (!sigiState?.LiveRoom) {
        return null;
      }
      
      // const ttUser = sigiState?.LiveRoom?.liveRoomUserInfo?.user;
      // const roomId = sigiState?.LiveRoom?.liveRoomUserInfo?.user?.roomId;
      const liveRoomInfo = sigiState?.LiveRoom?.liveRoomUserInfo?.liveRoom;
      if (liveRoomInfo?.status !== LIVE_STATUS) {
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
