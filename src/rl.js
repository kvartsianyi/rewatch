import readline from 'readline';

import CONFIG from './config.js';

export const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

if (CONFIG.IS_WINDOWS) {
  rl.on('SIGINT', () => process.emit('SIGINT'));
}