let {
	CHANNELS,
	OUTPUT_FOLDER_PATH,
	CHECK_SCHEDULE,
	LOGS_FOLDER,
	DEBUG,
} = process.env;

const IS_WINDOWS = process.platform.match(/win(32|64)/);
const EOL = IS_WINDOWS ? '\r\n' : '\n';
const FFMPEG_LOG_PATH = LOGS_FOLDER + '/ffmpeg-log.txt';
const SIGI_STATE_LOG_PATH = LOGS_FOLDER + '/sigi-log.txt';

const FFMREG_TIMESTAMP_WARNING = 'Timestamps are unset in a packet for stream';
const FFMREG_NON_MONOTONOUS_DTS_WARNING = 'Non-monotonous DTS';
const FFMPED_CRITICAL_WARNINGS = [
	FFMREG_TIMESTAMP_WARNING,
	FFMREG_NON_MONOTONOUS_DTS_WARNING,
];

CHANNELS = CHANNELS
	.split(',')
	.map(c => c.trim())
	.filter(Boolean);
OUTPUT_FOLDER_PATH ??= 'records';
CHECK_SCHEDULE ??= '*/3 * * * *';

const CONFIG = {
	CHANNELS,
	OUTPUT_FOLDER_PATH,
	CHECK_SCHEDULE,
	FFMPEG_LOG_PATH,
	FFMPED_CRITICAL_WARNINGS,
	SIGI_STATE_LOG_PATH,
	IS_WINDOWS,
	EOL,
	DEBUG,
};

export default CONFIG;