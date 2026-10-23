class Batcher {
  constructor(intervalMs, onFlush) {
    this.pending = new Set();
    this.onFlush = onFlush;
    this.timer = null;
    this.BATCH_INTERVAL = intervalMs;
  }

  enqueue(item) {
    if (this.pending.has(item)) return false;
    this.pending.add(item);
    this._ensureTimer();
    return true;
  }

  _ensureTimer() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this._flush();
      this.timer = null;
    }, this.BATCH_INTERVAL);
  }

  _flush() {
    const batch = [...this.pending];
    this.pending.clear();
    this.onFlush(batch);
  }

  forceFlush() {
    if (this.timer) clearTimeout(this.timer);
    this._flush();
    this.timer = null;
  }
}

export { Batcher };
