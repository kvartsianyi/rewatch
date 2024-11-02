import path from 'node:path';
import readline from 'readline';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

import { getTtStreamUrl } from './tt.js';
import CONFIG from './config.js';
import {
	log,
	writeToLog,
	getOutputFilePattern,
} from './utils.js';

const {
	CHANNELS,
	OUTPUT_FOLDER_PATH,
	FFMPEG_LOG_PATH,
	FFMPED_CRITICAL_WARNINGS,
	IS_WINDOWS,
	DEBUG,
} = CONFIG;

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

const INPUT_OPTIONS = [
	'-reconnect', '1',
	'-reconnect_at_eof', '1',
	'-reconnect_streamed', '1',
	'-reconnect_delay_max', '2',
];
const OUTPUT_OPTIONS = [
	'-c', 'copy',
	'-f', 'segment',
	'-segment_time', '600', // 10 minutes
	'-reset_timestamps', '1',
	'-movflags', '+faststart'
];

export const getBaseRecorder = (input, output) => {
	return ffmpeg()
		.input(input)
		.output(output)
		.inputOptions(INPUT_OPTIONS)
		.outputOptions(OUTPUT_OPTIONS);
};

const channelsToCheck = new Set(CHANNELS);

export const checkAvaliableStream = async (channel) => {
	try {
		const streamUrl = await getTtStreamUrl(channel);
		
		if (!streamUrl) {
			return null;
		}

		let isExitSignal = false;
		let isFfmpegCriticalWarning = false;
		const outputPath = path.resolve(OUTPUT_FOLDER_PATH, getOutputFilePattern(channel));

		const recorder = getBaseRecorder(streamUrl, outputPath)
			.on('start', () => {
				channelsToCheck.delete(channel);

				log(`Detected ${channel} is alive. Recording started...`);
			})
			.on('end', () => {
				channelsToCheck.add(channel);

				if (isExitSignal) {
					log(`Force exit. Recording finished...`);
		
					process.exit(0);
				}

				if (isFfmpegCriticalWarning) {
					log(`Detected timestamp warning for stream ${channel}. Recording restart...`);
					return handleStreamRecording(channel);
				}

				log(`Detected ${channel} is offline. Recording finished...`);
			})
			.on('error', err => {
				throw err
			})

		const command = recorder.run();

		const ffmpegShutdown = () => command?.ffmpegProc?.stdin.write('q');

		recorder.on('stderr', async (stdoutLine) => {
			if (DEBUG === 'ffmpeg') {
				await writeToLog(FFMPEG_LOG_PATH, stdoutLine);
			}

			isFfmpegCriticalWarning = FFMPED_CRITICAL_WARNINGS
				.some(warning => stdoutLine.includes(warning));
			if (isFfmpegCriticalWarning) {
				ffmpegShutdown();
			}
		});

		rl.on('line', () => {
			ffmpegShutdown();
			isExitSignal = true;
			rl.close();
		});

		if (IS_WINDOWS) {
			rl.on('SIGINT', () => process.emit('SIGINT'));
		}

		process.on('SIGINT', () => {
			ffmpegShutdown();
			isExitSignal = true;
		});

		return streamUrl;
	} catch (e) {
		channelsToCheck.add(channel);

		throw e;
	}
}

export class Recorder {
	#ffmpeg;
	#recorder;
	#process;

	constructor() {
		ffmpeg.setFfmpegPath(ffmpegPath);
		this.#ffmpeg = ffmpeg;
	}

	init({
		onStartCallback,
		onEndCallback,
		onErrorCallback,
		onStdoutCallback,
	}) {
		this.#recorder = this.#ffmpeg()
			.on('start', onStartCallback)
			.on('end', onEndCallback)
			.on('error', onErrorCallback)
			.on('stderr', onStdoutCallback);

		return this;
	};

	run(input, output) {
		if (!this.#recorder) {
			throw new Error('Init recorder first')
		}
		this.#process = this.#recorder
			.input(input)
			.output(output)
			.inputOptions(INPUT_OPTIONS)
			.outputOptions(OUTPUT_OPTIONS)
			.run();
	}

	async gracefulShutdown() {
		return new Promise((res, rej) => {
			const ffmpegProc = this.#process?.ffmpegProc;

			if (!ffmpegProc) {
				return rej(new Error('FFmpeg process doesn\'t exist'));
			}

			ffmpegProc.on('exit', this.#procesExitCallback(res, rej));
			ffmpegProc.stdin.write('q');
		});
	}

	#procesExitCallback(resolve, reject) {
		return (code, signal) => {
			if (code === 0 || signal === 'SIGTERM') {
				return resolve();
			}
			reject(new Error(`GracefulShutdownError: Code ${code}, Signal ${signal}`));
		}
	}
}
