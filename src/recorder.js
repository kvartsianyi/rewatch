import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

ffmpeg.setFfmpegPath(ffmpegPath);

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

export const getDefaultRecorder = (input, output) => {
	return ffmpeg()
		.input(input)
		.output(output)
		.inputOptions(INPUT_OPTIONS)
		.outputOptions(OUTPUT_OPTIONS);
};
