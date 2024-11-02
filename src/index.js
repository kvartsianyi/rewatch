import { TiktokRecorder } from './tt.js';
import { log } from './utils.js';
import { rl } from './rl.js';

const channel = 'kovrik_evalviv1';

await runRecorder(channel);

async function runRecorder(channel) {
  const tiktokRecorder = new TiktokRecorder();
  const stream = await tiktokRecorder.handleStreamRecording(channel);
  
  if (!stream) {
    log(`${channel} is currently offline.`);
    process.exit(0);
  }
  
  // Handle recording stop by pressing key from terminal
  rl.on('line', async () => {
    await tiktokRecorder.stopRecording();
    rl.close();
  });
  
  process.on('SIGINT', async () => {
    await tiktokRecorder.stopRecording();
  }); 
}