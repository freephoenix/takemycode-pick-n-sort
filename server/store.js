class Store {
  constructor() {
    this.items = new Map();       // id -> content
    this.allIds = new Set();      // существующие ID
    this.selectedIds = new Set();
    this.selectedOrder = [];
    this._contentSet = new Set(); // дедуп по content
    this._nextId = 1_000_001;
  }

  init() {
    for (let i = 1; i <= 1_000_000; i++) {
      const content = String(i);
      this.items.set(i, content);
      this.allIds.add(i);
      this._contentSet.add(content);
    }
  }

  hasContent(content) {
    return this._contentSet.has(String(content).trim());
  }

  addByContent(content) {
    const trimmed = String(content).trim();
    if (!trimmed || this._contentSet.has(trimmed)) {
      return null;
    }
    const id = this._nextId++;
    this.items.set(id, trimmed);
    this.allIds.add(id);
    this._contentSet.add(trimmed);
    return { id, content: trimmed };
  }

  select(id) {
    if (!this.allIds.has(id) || this.selectedIds.has(id)) {
      return false;
    }
    this.selectedIds.add(id);
    this.selectedOrder.push(id);
    return true;
  }

  deselect(id) {
    if (!this.selectedIds.has(id)) {
      return false;
    }
    this.selectedIds.delete(id);
    this.selectedOrder = this.selectedOrder.filter(x => x !== id);
    return true;
  }

  /**
   * Переместить itemId сразу после afterId (или сразу перед beforeId).
   * Работает независимо от фильтра на клиенте — ID уникальны.
   * @param {number} itemId
   * @param {number|null} beforeId
   * @param {number|null} afterId
   * @returns {number[]|null} новый порядок или null, если itemId не найден
   */
  reorderByAnchor(itemId, beforeId, afterId) {
    const idx = this.selectedOrder.indexOf(itemId);
    if (idx === -1) return null;
    const [item] = this.selectedOrder.splice(idx, 1);
    let insertAt = this.selectedOrder.length;
    if (beforeId != null) {
      const b = this.selectedOrder.indexOf(beforeId);
      if (b !== -1) insertAt = b;
    } else if (afterId != null) {
      const a = this.selectedOrder.indexOf(afterId);
      if (a !== -1) insertAt = a + 1;
    }
    this.selectedOrder.splice(insertAt, 0, item);
    return this.selectedOrder;
  }

  /** Невыбранные ID в порядке возрастания, отфильтрованные по q */
  * _unselectedSource(q) {
    const s = String(q).trim().toLowerCase();
    for (const id of this.allIds) {
      if (this.selectedIds.has(id)) {
        continue;
      }
      const content = this.items.get(id);
      if (s && !content.toLowerCase().includes(s)) {
        continue;
      }
      yield { id, content };
    }
  }

  /** Выбранные ID в порядке выбора, отфильтрованные по q */
  *_selectedSource(q) {
    const s = String(q).trim().toLowerCase();
    for (const id of this.selectedOrder) {
      const content = this.items.get(id);
      if (s && !content.toLowerCase().includes(s)) {
        continue;
      }
      yield { id, content };
    }
  }

  // ── Универсальные операции над генератором ──────────────

  static _take(iter, offset, limit) {
    const result = [];
    let i = 0;
    for (const v of iter) {
      if (i++ < offset) continue;
      if (result.length >= limit) break;
      result.push(v);
    }
    return result;
  }

  static _count(iter) {
    let n = 0;
    for (const _ of iter) n++;
    return n;
  }

  // ── Публичный API ───────────────────────────────────────

  getUnselected(offset, limit) {
    return Store._take(this._unselectedSource(''), offset, limit);
  }
  searchUnselected(q, offset, limit) {
    return Store._take(this._unselectedSource(q), offset, limit);
  }
  countUnselected(q) {
    return Store._count(this._unselectedSource(q));
  }

  getSelected(offset, limit) {
    return Store._take(this._selectedSource(''), offset, limit);
  }
  searchSelected(q, offset, limit) {
    return Store._take(this._selectedSource(q), offset, limit);
  }
  countSelected(q) {
    return Store._count(this._selectedSource(q));
  }
}

export const store = new Store();
