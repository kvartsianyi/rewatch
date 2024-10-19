let {
	CHANNELS,
	OUTPUT_FOLDER_PATH,
	CHECK_SCHEDULE,
	DEBUG,
} = process.env;

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
	DEBUG,
};

export default CONFIG;