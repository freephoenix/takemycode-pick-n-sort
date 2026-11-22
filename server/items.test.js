import request from 'supertest';
import app from './server.js';
import { store } from './store.js';

describe('Items API', () => {
  // Перед каждым тестом очищаем состояние (выбираем только 1 и 2 элементы)
  beforeEach(() => {
    store.selectedIds.clear();
    store.selectedOrder = [];
    store.select(1);
    store.select(2);
  });

  test('GET /api/items/unselected возвращает страницу', async () => {
    const response = await request(app)
        .get('/api/items/unselected?offset=0&limit=2')
        .expect('Content-Type', /json/)
        .expect(200);

    expect(response.body.items).toHaveLength(2);
    expect(response.body.items[0]).toEqual({ id: 3, content: '3' });
    expect(response.body.items[1]).toEqual({ id: 4, content: '4' });
    expect(response.body.hasMore).toBe(true);
    expect(response.body.nextOffset).toBe(2);
  });

  test('GET /api/items/selected возвращает выбранные элементы', async () => {
    const response = await request(app).get('/api/items/selected');
    expect(response.body.items).toEqual([
      { id: 1, content: '1' },
      { id: 2, content: '2' },
    ]);
    expect(response.body.total).toBe(2);
  });

  test('POST /api/items/select выбирает элемент', async () => {
    await request(app)
        .post('/api/items/select')
        .send({ id: 3 })
        .expect(200);

    const response = await request(app).get('/api/items/selected');
    expect(response.body.total).toBe(3);
    expect(response.body.items[2]).toEqual({ id: 3, content: '3' });
  });

  test('POST /api/items/add ставит элемент в очередь', async () => {
    const response = await request(app)
        .post('/api/items/add')
        .send({ content: 'test item' })
        .expect(200);

    expect(response.body).toEqual({ queued: true, reason: 'queued' });
  });
});
