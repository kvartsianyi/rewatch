import path from 'node:path';
import { mkdir, readdir, rename } from 'node:fs/promises';

import { TiktokRecorder } from './tt.js';
import CONFIG from './config.js';
import { log } from './utils.js';
import { rl } from './rl.js';
import { convertToMp4 } from './utils.js';

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

  const convertCallback = async () => {
    try {
      log('Convertation started...');
      const files = await readdir(OUTPUT_FOLDER_PATH);
      const mkvFiles = await files
      .filter(f => f.includes(uniqueId) && f.toLowerCase().endsWith('.mkv'));
      
      const SOURCES_PATH = path.join(OUTPUT_FOLDER_PATH, 'sources');
      await mkdir(SOURCES_PATH, { recursive: true });

      const convertPromises = mkvFiles.map(async (file) => {
        try {
          const inputPath = path.join(OUTPUT_FOLDER_PATH, file);
          const outputPath = path.join(OUTPUT_FOLDER_PATH, path.basename(file, '.mkv') + '.mp4');

          await convertToMp4(inputPath, outputPath);
          await rename(inputPath, path.join(SOURCES_PATH, file));
        } catch {
          // skip
        }
      });
      
      await Promise.all(convertPromises);
      log('Convertation finished!');
    } catch(e) {
      log('Convertation error: ', e?.message);
    }
  };

  const gracefullExit = async () => {
    await convertCallback();
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