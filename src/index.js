import { TiktokRecorder } from './tt.js';
import CONFIG from './config.js';
import { log } from './utils.js';
import { rl } from './rl.js';

const { CHANNELS } = CONFIG;

const uniqueId = CHANNELS[0];

await runRecorder(uniqueId);

async function runRecorder(uniqueId) {
  const tiktokRecorder = new TiktokRecorder();
  tiktokRecorder.setChannel(uniqueId);
  const stream = await tiktokRecorder.handleStreamRecording(uniqueId);
  
  if (!stream) {
    log(`${uniqueId} is currently offline.`);
    process.exit(0);
  }

  const gracefullShutdown = async () => {
    await tiktokRecorder.stopRecording();
    rl.close();
    process.exit(0);
  }
  
  rl.once('line', gracefullShutdown);
  process.once('SIGINT', gracefullShutdown); 
}