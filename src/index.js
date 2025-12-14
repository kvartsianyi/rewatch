import { mkdir } from 'node:fs/promises';

import { TiktokRecorder } from './tt.js';
import CONFIG from './config.js';
import { log } from './utils.js';
import { rl } from './rl.js';

// TODO: List of improvements
// 1. Add auto-create output directory - done
// 2. Add watch mode(check if user is alive by interval) for single channel


const { CHANNELS, OUTPUT_FOLDER_PATH } = CONFIG;

const uniqueId = CHANNELS[0];

// Create output directory if it doesn't exist
await mkdir(OUTPUT_FOLDER_PATH, { recursive: true });

await runRecorder(uniqueId);

async function runRecorder(uniqueId) {
  const tiktokRecorder = new TiktokRecorder();
  tiktokRecorder.setChannel(uniqueId);
  const stream = await tiktokRecorder.handleStreamRecording();
  
  if (!stream) {
    log(`${uniqueId} is currently offline.`);
    return process.exit(0);
  }

  const gracefullExit = () => {
    log('Shutting down...');
    rl.close();
    process.exit(0);
  }

  tiktokRecorder.on('end', gracefullExit);
	tiktokRecorder.on('error', gracefullExit);

  const gracefullShutdown = async () => {
    await tiktokRecorder.stopRecording();
  }
  
  rl.once('line', gracefullShutdown);
  process.once('SIGINT', gracefullShutdown); 
}