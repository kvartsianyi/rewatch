import path from 'node:path';
import readline from 'readline';

import CONFIG from './config.js';
import { getTtStreamUrl } from './tt.js';
import { log, getOutputFilePattern } from './utils.js';
import { getBaseRecorder } from './recorder.js';

const {
  CHANNELS,
	OUTPUT_FOLDER_PATH,
	DEBUG,
} = CONFIG;


const [channel] = CHANNELS;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const streamUrl = await getTtStreamUrl(channel);

if (!streamUrl) {
  log(`Channel ${channel} is currently offline.`);
  process.exit(0);
}

let isExitSignal = false;
const outputPath = path.resolve(OUTPUT_FOLDER_PATH, getOutputFilePattern(channel));

const recorder = getBaseRecorder(streamUrl, outputPath);
recorder
  .on('start', () => {
    log(`Detected ${channel} is alive. Recording started...`);
  })
  .on('end', () => {
    if (isExitSignal) {
      log(`Force exit. Recording finished...`);

      process.exit(0);
    }

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