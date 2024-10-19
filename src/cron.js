import { CronJob, sendAt } from 'cron';
import readline from 'readline';
import path from 'node:path';

import CONFIG from './config.js';
import { log, sleep, getOutputFilePattern } from './utils.js';
import { getTtStreamUrl } from './tt.js';
import { getBaseRecorder } from './recorder.js';

console.clear();

const {
	CHANNELS,
	CHECK_SCHEDULE,
	OUTPUT_FOLDER_PATH,
	DEBUG,
} = CONFIG;

const channelsToCheck = new Set(CHANNELS);
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

const checkAvaliableStream = async (channel) => {
	try {
		const streamUrl = await getTtStreamUrl(channel);
		
		if (!streamUrl) {
			return null;
		}

		let isExitSignal = false;
		const outputPath = path.resolve(OUTPUT_FOLDER_PATH, getOutputFilePattern(channel));

		const recorder = getBaseRecorder(streamUrl, outputPath);
		recorder
			.on('start', () => {
				channelsToCheck.delete(channel);

				log(`Detected ${channel} is alive. Recording started...`);
			})
			.on('end', () => {
				channelsToCheck.add(channel);

				if (isExitSignal) process.exit(0);

				log(`Detected ${channel} is offline. Recording finished...`);
			})
			.on('error', err => {
				throw err
			})
			.on('stderr', err => {
				if (DEBUG === 'ffmpeg') {
					log('ffmpeg stdout: ', err);
				}
			});

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
			command.ffmpegProc.stdin.write('q');
			isExitSignal = true;
		});

		return streamUrl;
	} catch (e) {
		channelsToCheck.add(channel);

		throw e;
	}
}

const checkAvaliableStreams = async () => {
	for (const channel of channelsToCheck) {
		try {
			log(`Checking if ${channel} is alive...`);

			await checkAvaliableStream(channel);
			await sleep(100);
		} catch (error) {
			log(`Error while checking channel ${channel}`, error);
		}
	}

	const nextTryAt = sendAt(CHECK_SCHEDULE)
		.toISO({
			includeOffset: false,
			suppressMilliseconds: true,
		});
	log(`Next check on ${nextTryAt}`);
}

const job = new CronJob(
	CHECK_SCHEDULE,
	checkAvaliableStreams,
	undefined,
	undefined,
	undefined,
	undefined,
	true,
);
job.start();