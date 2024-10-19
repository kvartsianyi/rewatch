import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

const INPUT_OPTIONS = [
	'-reconnect', '1',
	'-reconnect_at_eof', '1',
	'-reconnect_streamed', '1',
	'-reconnect_delay_max', '2'
];
const OUTPUT_OPTIONS = [
	'-c', 'copy',
	'-f', 'segment',
	'-segment_time', '600',
	'-reset_timestamps', '1',
	'-movflags', '+faststart'
];

export class RecorderService {
	process;

	constructor() {
		ffmpeg.setFfmpegPath(ffmpegPath);
	}

	async startRecording(input, output) {
		return new Promise((resolve, reject) => {
			const command = ffmpeg()
			.input(input)
			.inputOptions(INPUT_OPTIONS)
			.outputOptions(OUTPUT_OPTIONS)
			.output(output)
			.on('start', (commandLine) => {
				console.log('Started FFmpeg with command: ' + commandLine);
				resolve(commandLine);
			})
			.on('end', () => {
				console.log('Processing finished successfully');
			})
			.on('error', (err) => {
				console.error('Error during processing: ' + err.message);
				reject(err);
			})
			.on('stderr', err => {
				process.stdout.moveCursor(0, -1); // up one line
				process.stdout.clearLine(1);

				console.log('ffmpeg log: ' + err)
			});
	
			this.process = command.run();
		});
	}

	endRecording() {
		this.process.ffmpegProc.stdin.write('q');
	}
}