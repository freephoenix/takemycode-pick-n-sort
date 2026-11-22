import { store } from './store.js';
import { Batcher } from './batcher.js';

class DedupQueue {
  constructor() {
    this.batcher = new Batcher(10_000, (batch) => {
      for (const content of batch) {
        store.addByContent(content);
      }
    });
  }

  enqueue(content) {
    const trimmed = String(content).trim();
    if (!trimmed) return false;
    if (store.hasContent(trimmed)) return false;
    return this.batcher.enqueue(trimmed);
  }

  forceFlush() {
    return this.batcher.forceFlush();
  }
}

export const dedupQueue = new DedupQueue();
