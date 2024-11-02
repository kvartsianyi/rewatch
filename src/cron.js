import { CronJob } from 'cron';

import CONFIG from './config.js';
import { TiktokRecorder } from './tt.js';
import { rl } from './rl.js';
import {
	log,
	sleep,
	jobNextRunAt,
} from './utils.js';

const {
	CHANNELS,
	CHECK_SCHEDULE,
} = CONFIG;

const channelsToWatch = new Set(CHANNELS);
const watchChannel = channel => {
	channelsToWatch.add(channel);
	recordingSignals.delete(channel);
};
const unwatchChannel = (channel, signal) => {
	channelsToWatch.delete(channel);
	recordingSignals.set(channel, signal);
};
const recordingSignals = new Map();
const stopAllRecordings = async () => {
	const promises = Array
		.from(recordingSignals.values())
		.map(fn => fn());

	return Promise.allSettled(promises);
};

const handleStreamRecording = async (channel) => {
	try {
		const endCallback = () => {
			watchChannel(channel);
			log(`Channel ${channel}. Recording finished...`);
		};

		const tiktokRecorder = new TiktokRecorder({ endCallback });
		const stream = await tiktokRecorder.handleStreamRecording(channel);
		
		if (!stream) {
			return null;
		}

		const stopRecording = tiktokRecorder
			.stopRecording.bind(tiktokRecorder);
		unwatchChannel(channel, stopRecording);

		return stream;
	} catch (e) {
		watchChannel(channel);

		throw e;
	}
}

const handleStreamsRecording = async () => {
	for (const channel of channelsToWatch) {
		try {
			log(`Checking if ${channel} is alive...`);

			await handleStreamRecording(channel);
			await sleep(100);
		} catch (error) {
			log(`Error while checking channel ${channel}`, error);
		}
	}

	log(`Next check on ${jobNextRunAt()}`);
}

const job = new CronJob(
	CHECK_SCHEDULE,
	handleStreamsRecording,
	undefined,
	undefined,
	undefined,
	undefined,
	true,
);
job.start();

rl.on('line', async () => {
	// await tiktokRecorder.stopRecording();
	rl.close();
});

process.on('SIGINT', async () => {
	await stopAllRecordings();
	process.exit(0);
});