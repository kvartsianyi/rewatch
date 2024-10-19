import readline from 'readline';

import { RecorderService } from './services/index.js';
import { getTtStreamUrl } from './tt.js';


// const channel = 'angelokkk7777';
// const channel = 'kovrik_evalviv1';
const channel = 'aniiitta_99';
const inputStream = await getTtStreamUrl(channel);
// console.log(inputStream)

const date = new Date();
const timestamp = `${date.getHours()}${date.getMinutes()}${date.getSeconds()}`;
const outputFilePattern = channel + '_' + timestamp + '_%03d.mp4'; // Output pattern for segments
const recordService = new RecorderService();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

await recordService.startRecording(inputStream, outputFilePattern);

rl.on('line', () => {
  recordService.endRecording();
  rl.close();
});