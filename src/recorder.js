import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

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
}
