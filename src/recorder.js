import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

import CONFIG from './config.js';

const { OUTPUT_FILE_EXT } = CONFIG;

const INPUT_OPTIONS = [
	'-reconnect', '1',
	'-reconnect_at_eof', '1',
	'-reconnect_streamed', '1',
	'-reconnect_delay_max', '2',
	'-fflags', '+genpts', // Generate missing PTS dynamically
];
const OUTPUT_OPTIONS = [
	'-c', 'copy',
	'-f', 'segment',
	'-segment_time', '1200', // 20 minutes
	'-reset_timestamps', '1',
	...(OUTPUT_FILE_EXT === 'mp4' ? ['-movflags', '+faststart'] : []),
];

export class Recorder {
	#ffmpeg;
	#process;

	constructor() {
		ffmpeg.setFfmpegPath(ffmpegPath);
		this.#ffmpeg = ffmpeg;
	}

	init() {
		this.#process = this.#ffmpeg();

		return this;
	};

	run(input, output) {
		if (!this.#process) {
			throw new Error('Init recorder first')
		}
		this.#process = this.#process
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

			ffmpegProc.once('exit', this.#procesExitCallback(res, rej));
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

	on(event, callback) {
		this.#process.on(event, callback);

		return this;
	}
}
