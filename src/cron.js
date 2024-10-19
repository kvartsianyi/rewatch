import { CronJob, sendAt } from 'cron';
import readline from 'readline';

import { log } from './utils.js';
import { getTtStreamUrl } from './tt.js';
import { getDefaultRecorder } from './recorder.js';

const channel = 'kudriava_malyshka';
let isRecording = false;
let isExitSignal = false;
const jobShedule = '*/3 * * * *';

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

const checkAvaliableStreams = async () => {
	try {
		const nextTryAt = sendAt(jobShedule).toISO();
		const streamUrl = await getTtStreamUrl(channel);

		if (!streamUrl || isRecording) {
			log(`Recording: ${isRecording}. Next check in ${nextTryAt}`);
			return;
		}

		const date = new Date();
		const timestamp = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()} ${date.getHours()}_${date.getMinutes()}_${date.getSeconds()}`;
		const outputFilePattern = 'records/' + channel + ' ' + timestamp + ' %03d.mp4'; // Output pattern for segments

		const recorder = getDefaultRecorder(streamUrl, outputFilePattern);
		recorder
			.on('start', () => {
				isRecording = true;
				log('Recording started: ' + channel);
			})
			.on('end', () => {
				isRecording = false;
				log('Recording finished: ' + channel);

				if (isExitSignal) {
					process.exit(0);
				}
			})
			.on('error', err => {
				throw err
			})
			// .on('stderr', err => {
			// 	process.stdout.moveCursor(0, -1); // up one line
			// 	process.stdout.clearLine(1);

			// 	console.log('ffmpeg log: ' + err)
			// });

		const command = recorder.run();

		rl.on('line', () => {
			command.ffmpegProc.stdin.write('q');
			isExitSignal = true;
			rl.close();
		});

		if (process.platform === 'win32') {
			rl.on('SIGINT', () => process.emit('SIGINT'));
		}

		process.on('SIGINT', () => {
			console.log('SIGINT')
			command.ffmpegProc.stdin.write('q');
			isExitSignal = true;
		});
	} catch (e) {
		isRecording = false;
		console.log(e);
		log('checkAvaliableStreams Error: ' + e?.message);
	}
}

const job = new CronJob(jobShedule, checkAvaliableStreams);
job.start();