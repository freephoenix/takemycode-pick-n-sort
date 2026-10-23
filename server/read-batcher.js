import { Batcher } from './batcher.js';

export const readBatcher = new Batcher(1_000, (batch) => {
  for (const fn of batch) {
    try {
      fn();
    } catch (e) {
      console.error('[read-batcher] task failed:', e);
    }
  }
});
