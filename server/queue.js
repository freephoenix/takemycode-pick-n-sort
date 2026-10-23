import { store } from './store.js';
import { Batcher } from './batcher.js';

class DedupQueue {
  constructor() {
    this.processed = new Set();
    this.batcher = new Batcher(10_000, (batch) => {
      for (const id of batch) {
        if (store.addId(id)) {
          this.processed.add(id);
        }
      }
    });
  }

  enqueue(id) {
    if (this.processed.has(id)) return false;
    return this.batcher.enqueue(id);
  }

  forceFlush() {
    return this.batcher.forceFlush();
  }
}

export const dedupQueue = new DedupQueue();
