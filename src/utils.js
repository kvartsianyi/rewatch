import fs from 'node:fs';
import { promisify } from 'node:util';
import { sendAt } from 'cron';

import CONFIG from './config.js';

const {
	EOL,
	CHECK_SCHEDULE,
	OUTPUT_FILE_EXT,
	FFMPED_CRITICAL_WARNINGS,
} = CONFIG;
const appendFileAsync = promisify(fs.appendFile);

export const log = (message, data = '') => console.log(message, data);

export const timestamp = (date = new Date()) => {
	const format = number => String(number).padStart(2, '0');

	const year = format(date.getFullYear());
	const month = format(date.getMonth() + 1);
	const day = format(date.getDate());
	const hour = format(date.getHours());
	const minute = format(date.getMinutes());
	const second = format(date.getSeconds());

	return [year, month, day, hour, minute, second].join('_');
}

export const getOutputFilePattern = channel => [
	channel,
	timestamp(),
	`%03d.${OUTPUT_FILE_EXT}`,
].join('_');

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export const writeToLog = async (path, data) => appendFileAsync(path, data + EOL);

export const jobNextRunAt = (schedule = CHECK_SCHEDULE) => sendAt(schedule)
	.toISO({
		includeOffset: false,
		suppressMilliseconds: true,
	});

export const isCriticalWarning = message => FFMPED_CRITICAL_WARNINGS
	.some(warning => message.includes(warning));