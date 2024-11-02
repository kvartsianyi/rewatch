import { CronJob, sendAt } from 'cron';
import readline from 'readline';
import path from 'node:path';
import fs from 'node:fs';


import CONFIG from './config.js';
import { log, sleep, writeToLog, getOutputFilePattern } from './utils.js';
import { getTtStreamUrl } from './tt.js';
import { getBaseRecorder } from './recorder.js';

const {
	CHANNELS,
	CHECK_SCHEDULE,
	OUTPUT_FOLDER_PATH,
	FFMPEG_LOG_PATH,
	FFMPED_CRITICAL_WARNINGS,
	DEBUG,
} = CONFIG;

if (fs.existsSync(FFMPEG_LOG_PATH)) {
  fs.unlinkSync(FFMPEG_LOG_PATH);
}
// console.clear();

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

		if (process.platform === 'win32') {
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