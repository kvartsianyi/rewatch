let {
	CHANNELS,
	OUTPUT_FOLDER_PATH,
	CHECK_SCHEDULE,
	LOGS_FOLDER,
	DEBUG,
} = process.env;

const TT_HEADERS = {
	Connection: 'keep-alive',
	'Cache-Control': 'max-age=0',
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36',
	Accept: 'text/html,application/json,application/protobuf',
	Referer: 'https://www.tiktok.com/',
	Origin: 'https://www.tiktok.com',
	'Accept-Language': 'en-US,en;q=0.9',
	'Accept-Encoding': 'gzip, deflate',
};
const URL_WEB_LIVE = "https://www.tiktok.com/@{channel}/live";
// 0 - Error or Inactive stream.
// 1 - Stream Starting or Preparing (the stream is not yet live but in the setup phase).
// 2 - Live
// 3 - Temporarily Suspended (for streams interrupted, often due to network issues).
// 4 - Offline
// 5 - Ended (Something like terminated or due to technical issues)
// 6 - Banned or Restricted (usually the result of violations during the stream, leading to a ban).
const LIVE_STATUS = 2;

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
const OUTPUT_FILE_EXT = 'mkv';

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
	OUTPUT_FILE_EXT,
	IS_WINDOWS,
	TT_HEADERS,
	URL_WEB_LIVE,
	LIVE_STATUS,
	EOL,
	DEBUG,
};

export default CONFIG;