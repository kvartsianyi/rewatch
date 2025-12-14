let {
	CHANNELS,
	STREAM_URL,
	OUTPUT_FOLDER_PATH,
	CHECK_SCHEDULE,
	LOGS_FOLDER,
	COOKIE,
	DEBUG,
} = process.env;

const DEFAULT_TT_REQUEST_HEADERS = {
	Connection: 'keep-alive',
	'Cache-Control': 'max-age=0',
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36',
	Accept: 'text/html,application/json,application/protobuf',
	Referer: 'https://www.tiktok.com/',
	Origin: 'https://www.tiktok.com',
	'Accept-Language': 'en-US,en;q=0.9',
	'Accept-Encoding': 'gzip, deflate',
};
const DEFAULT_TT_CLIENT_PARAMS = {
	aid: 1988,
	app_language: 'en-US',
	app_name: 'tiktok_web',
	browser_language: 'en',
	browser_name: 'Mozilla',
	browser_online: true,
	browser_platform: 'Win32',
	browser_version: '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36',
	cookie_enabled: true,
	cursor: '',
	internal_ext: '',
	device_platform: 'web',
	focus_state: true,
	from_page: 'user',
	history_len: 0,
	is_fullscreen: false,
	is_page_visible: true,
	did_rule: 3,
	fetch_rule: 1,
	last_rtt: 0,
	live_id: 12,
	resp_content_type: 'protobuf',
	screen_height: 1152,
	screen_width: 2048,
	tz_name: 'Europe/Berlin',
	referer: 'https://www.tiktok.com/',
	root_referer: 'https://www.tiktok.com/',
	host: 'https://webcast.tiktok.com',
	webcast_sdk_version: '1.3.0',
	update_version_code: '1.3.0'
};
const WEB_LIVE_URL = "https://www.tiktok.com/@{uniqueId}/live";
const API_LIVE_ROOM_URL = 'https://www.tiktok.com/api-live/user/room/';
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
const OUTPUT_FILE_EXT = 'mkv';

CHANNELS = CHANNELS
	.split(',')
	.map(c => c.trim())
	.filter(Boolean);
OUTPUT_FOLDER_PATH ??= 'records';
CHECK_SCHEDULE ??= '*/3 * * * *';

const CONFIG = {
	CHANNELS,
	COOKIE,
	STREAM_URL,
	OUTPUT_FOLDER_PATH,
	CHECK_SCHEDULE,
	FFMPEG_LOG_PATH,
	SIGI_STATE_LOG_PATH,
	OUTPUT_FILE_EXT,
	IS_WINDOWS,
	DEFAULT_TT_REQUEST_HEADERS,
	WEB_LIVE_URL,
	DEFAULT_TT_CLIENT_PARAMS,
	API_LIVE_ROOM_URL,
	LIVE_STATUS,
	EOL,
	DEBUG,
};

export default CONFIG;