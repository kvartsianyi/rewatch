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
  DEFAULT_TT_REQUEST_HEADERS,
  DEFAULT_TT_CLIENT_PARAMS,
  API_LIVE_ROOM_URL,
	WEB_LIVE_URL,
	LIVE_STATUS,
	DEBUG,
} = CONFIG;

export class TiktokParser {
  #httpClient;

  constructor() {
    this.#httpClient = axios.create({
      timeout: 10000,
      headers: DEFAULT_TT_REQUEST_HEADERS,
    });
  }

  async getTtStreamUrl(uniqueId) {
    let liveRoomInfo = {};

		try {
			try {
				liveRoomInfo = await this.#getLiveRoomInfoFromApi(uniqueId);
			} catch (e) {
				// Use fallback method
				liveRoomInfo = await this.#getLiveRoomInfoFromHtml(uniqueId);
			}
		} catch (e) {
			throw new Error(`Failed to retrieve live room info for ${uniqueId}. ${err.message}`);
		}
  
    if (!liveRoomInfo) {
      return null;
    }

    if (!liveRoomInfo.streamData) {
      throw new Error(`${uniqueId} require to be authenticated.`);
    }

    if (liveRoomInfo.status !== LIVE_STATUS) {
      return null;
    }
  
    const streams = this.#parseStreams(liveRoomInfo.streamData);
    const originalStreamUrl = this.#findBestStreamQualityUrl(streams);

    return this.#isStreamAccessible(originalStreamUrl);
  }

  async #getLiveRoomInfoFromHtml(uniqueId) {
    try {
      const liveUrl = WEB_LIVE_URL.replace("{uniqueId}", uniqueId);
      const response = await this.#httpClient.get(liveUrl, {
        headers: DEFAULT_TT_REQUEST_HEADERS,
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
  
      return liveRoomInfo;
    } catch (error) {
      console.error("Error fetching live room details:", error);
      return null;
    }
  }
  
  async #getLiveRoomInfoFromApi(uniqueId) {
    const { data: liveRoomResponse } = await this.#httpClient(API_LIVE_ROOM_URL, {
      params: { 
        ...DEFAULT_TT_CLIENT_PARAMS,
        uniqueId,
        sourceType: 54, // Magic number from TikTok
      },
    });

    const liveRoomInfo = liveRoomResponse?.data?.liveRoom;

    return liveRoomInfo;
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
      const { status } = await this.#httpClient.head(streamUrl, {
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
  uniqueId;

	constructor(options) {
    this.#parser = new TiktokParser();
		this.#recorder = new Recorder().init();
    this.#recorder
      .on('start', this.#startCallback.bind(this))
      .on('end', options?.endCallback || this.#endCallback.bind(this))
      .on('error', this.#errorCallback.bind(this))
      .on('stderr', this.#stdoutCallback.bind(this));
	}

  setChannel(uniqueId) {
    this.uniqueId = uniqueId;
  }

  async handleStreamRecording() {
    try {
      if (!this.uniqueId) {
        throw new Error('Channel is required');
      }

      const streamUrl = await this.#parser.getTtStreamUrl(this.uniqueId);
		
      if (!streamUrl) {
        return null;
      }

      const outputPath = this.#generateOutputPath(this.uniqueId);

      this.startRecording(streamUrl, outputPath);

      return streamUrl;
    } catch (e) {
      log('[handleStreamRecording] Error:', e);
    }
  }

  startRecording(input, output) {
    return this.#recorder.run(input, output);
  }

  async stopRecording() {
    return this.#recorder.gracefulShutdown();
  }

  #generateOutputPath() {
    return path.resolve(OUTPUT_FOLDER_PATH, getOutputFilePattern(this.uniqueId));
  }

	#startCallback() {
    log(`Channel ${this.uniqueId}. Recording started...`);
  }

  #endCallback() {
    log(`Channel ${this.uniqueId}. Recording finished...`);
    this.uniqueId = null;
  }

  async #errorCallback(err, stdout, stderr) {
    log(`Channel ${this.uniqueId}. Error during recording:`, err);
    log(`Ffmpeg stdout:`, stdout);
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

  on(event, callback) {
    this.#recorder.on(event, callback);

    return this;
  }
}
