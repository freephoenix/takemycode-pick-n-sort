class Store {
  constructor() {
    this.allIds = new Set();
    this.selectedIds = new Set();
    this.selectedOrder = [];
    this._seen = new Set();
  }

  init() {
    for (let i = 1; i <= 1_000_000; i++) {
      this.allIds.add(i);
    }
  }

  addId(id) {
    if (this._seen.has(id)) return false;
    this._seen.add(id);
    this.allIds.add(id);
    return true;
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
    if (!this.selectedIds.has(id)) return false;
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
      if (b !== -1) {
        insertAt = b;
      }
    } else if (afterId != null) {
      const a = this.selectedOrder.indexOf(afterId);
      if (a !== -1) {
        insertAt = a + 1;
      }
    }

    this.selectedOrder.splice(insertAt, 0, item);
    return this.selectedOrder;
  }

  /** Невыбранные ID в порядке возрастания, отфильтрованные по q */
  * _unselectedSource(q) {
    const s = String(q).trim();
    for (const id of this.allIds) {
      if (this.selectedIds.has(id)) continue;
      if (s && !String(id).includes(s)) continue;
      yield id;
    }
  }

  /** Выбранные ID в порядке выбора, отфильтрованные по q */
  * _selectedSource(q) {
    const s = String(q).trim();
    for (const id of this.selectedOrder) {
      if (s && !String(id).includes(s)) continue;
      yield id;
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
