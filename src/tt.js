import * as cheerio from 'cheerio';
import axios from 'axios';
import path from 'node:path';

import { Recorder } from './recorder.js';
import CONFIG from './config.js';
import {
	log,
	writeToLog,
  isCriticalWarning,
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

    if (!liveRoomInfo?.streamData) {
      throw new Error(`${channel} require to be authenticated.`);
    }
  
    const streams = this.#parseStreams(liveRoomInfo.streamData);
    const originalStreamUrl = this.#findBestStreamQualityUrl(streams);

    return this.#isStreamAccessible(originalStreamUrl);
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

  async #isStreamAccessible(streamUrl) {
    try {
      const { status } = await this.#axios.head(streamUrl, {
        responseType: 'stream',
      });

      return status === 200 ? streamUrl : null;
    } catch (e) {
      if (e?.response?.status === 404) {
        return null;
      }

      log('Error during stream accessibility check: ', e);
      throw e;
    }
  }
}

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

  async #errorCallback(err, stdout, stderr) {
    log(`Channel ${this.channel}. Error during recording:`, err);
    log(`Ffmpeg stderr:`, stderr);

    try {
      await this.stopRecording();
    } catch (e) {
      // skip error
    }
  }

  async #stdoutCallback(stdoutLine) {
    try {
      if (DEBUG === 'ffmpeg') {
        await writeToLog(FFMPEG_LOG_PATH, stdoutLine);
      }

      if (isCriticalWarning(stdoutLine)) {
        try {
          this.#recorder.removeListener('stderr', this.#stdoutCallback);
          await this.stopRecording();
        } catch (e) {
          // skip error
        }
      }
    } catch (e) {
      log('ffmpegStdoutCallbackError:', e);
    }
  }
}
