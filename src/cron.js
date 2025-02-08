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

const handleStreamRecording = async (uniqueId) => {
	const tiktokRecorder = new TiktokRecorder();
	tiktokRecorder.setChannel(uniqueId);
	const stream = await tiktokRecorder.handleStreamRecording(uniqueId);

	if (!stream) return null;
	channelsToWatch.delete(uniqueId);

	const gracefullShutdown = () => {
		tiktokRecorder.stopRecording();
		channelsToWatch.add(uniqueId);
	}
	const removeShutdownListeners = () => {
		rl.removeListener('line', gracefullShutdown);
		process.removeListener('SIGINT', gracefullShutdown);
		channelsToWatch.add(uniqueId);
	};

	rl.once('line', gracefullShutdown);
	process.once('SIGINT', gracefullShutdown);

	tiktokRecorder.on('end', removeShutdownListeners);
	tiktokRecorder.on('error', removeShutdownListeners);

	return stream;
}

const handleStreamsRecordingJob = async () => {
	for (const channel of channelsToWatch) {
		try {
			const stream = await handleStreamRecording(channel);

			log(`User ${channel} is ${stream ? 'alive...' : 'currently offline...'}`);
		} catch (error) {
			log(`[handleStreamsRecordingJob] Channel ${channel}.`, error);
		}
	}

	if (channelsToWatch.size === CHANNELS.length) {
		log(`Next check on ${jobNextRunAt()}`);
	}
}

const handleStreamsRecording = CronJob.from({
	cronTime: CHECK_SCHEDULE,
	onTick: handleStreamsRecordingJob,
	runOnInit: true,
});
handleStreamsRecording.start();

const shutDown = async () => {
	let retryAttempts = 5;

	while (retryAttempts > 0) {
		retryAttempts--;

		// All recordings are stopped
		if (channelsToWatch.size === CHANNELS.length) {
			log('Shutting down...');
			rl.close();
			return process.exit(0);
		}

		await sleep(100);
	}

	rl.close();
	process.exit(0);
}

rl.on('line', shutDown);
process.on('SIGINT', shutDown);