import express from 'express';
import cors from 'cors';

import { store } from './store.js';
import { dedupQueue } from './queue.js';
import { readBatcher } from './read-batcher.js';

// ─── Инициализация ────────────────────────────────────────

store.init();

const app = express();
app.use(cors());
app.use(express.json());

const PAGE_SIZE = 20;

// ─── Хелперы (должны быть объявлены до использования) ────

function parseIntOr(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function pageResponse(res, items, total, offset) {
  res.json({
    items,
    total,
    hasMore: offset + items.length < total,
    nextOffset: offset + items.length,
  });
}

/**
 * Фабрика GET-эндпоинтов с пагинацией.
 * @param {Function} sourceFn  (q, offset, limit) => number[]
 * @param {Function} countFn   (q) => number
 */
function listEndpoint(sourceFn, countFn) {
  return (req, res) => {
    const offset = Math.max(0, parseIntOr(req.query.offset, 0));
    const limit = Math.min(parseIntOr(req.query.limit, PAGE_SIZE), PAGE_SIZE);
    const q = req.query.q || '';

    readBatcher.enqueue(() => {
      try {
        pageResponse(
            res,
            sourceFn(q, offset, limit),
            countFn(q),
            offset,
        );
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });
  };
}

// ─── ЛЕВОЕ ОКНО ───────────────────────────────────────────

app.get('/api/items/unselected', listEndpoint(
    (q, o, l) => q ? store.searchUnselected(q, o, l) : store.getUnselected(o, l),
    q => store.countUnselected(q),
));

app.post('/api/items/add', (req, res) => {
  const { id } = req.body;
  if (id == null || !Number.isInteger(id)) {
    return res.status(400).json({ error: 'ID должен быть целым числом' });
  }
  const queued = dedupQueue.enqueue(id);
  res.json({ queued, id });
});

app.post('/api/items/select', (req, res) => {
  const { id } = req.body;
  if (id == null) return res.status(400).json({ error: 'ID обязателен' });
  const ok = store.select(id);
  res.json({ selected: ok, id });
});

// ─── ПРАВОЕ ОКНО ──────────────────────────────────────────

app.get('/api/items/selected', listEndpoint(
    (q, o, l) => q ? store.searchSelected(q, o, l) : store.getSelected(o, l),
    q => store.countSelected(q),
));

app.post('/api/items/deselect', (req, res) => {
  const { id } = req.body;
  if (id == null) return res.status(400).json({ error: 'ID обязателен' });
  const ok = store.deselect(id);
  res.json({ deselected: ok, id });
});

// Reorder по ID + якорь (beforeId/afterId), а не по индексам.
// Работает при активном фильтре: сервер находит ID в полном selectedOrder.
app.put('/api/items/reorder', (req, res) => {
  const { itemId, beforeId, afterId } = req.body;
  if (itemId == null || !Number.isInteger(itemId)) {
    return res.status(400).json({ error: 'itemId обязателен (integer)' });
  }

  const order = store.reorderByAnchor(
      itemId,
      beforeId != null ? Number(beforeId) : null,
      afterId != null ? Number(afterId) : null,
  );

  if (order == null) {
    return res.status(404).json({ error: 'item не найден среди выбранных' });
  }
  res.json({ ok: true });
});

// ─── Состояние ────────────────────────────────────────────

app.get('/api/items/state', (req, res) => {
  readBatcher.enqueue(() => {
    try {
      res.json({
        selectedOrder: store.selectedOrder,
        selectedCount: store.selectedIds.size,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

app.get('/', (_req, res) => res.json({ ok: true }));

// ─── Запуск ───────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend на порту ${PORT}`));
