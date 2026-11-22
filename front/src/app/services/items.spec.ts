import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Items } from './items';

describe('Items', () => {
  let service: Items;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [Items, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(Items);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('должен запрашивать невыбранные элементы с правильными параметрами', () => {
    service.getItems('unselected', 0, 20, '3').subscribe();

    const req = httpMock.expectOne(
      r => r.url.endsWith('/unselected') && r.params.get('q') === '3'
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('offset')).toBe('0');
    expect(req.request.params.get('limit')).toBe('20');

    // content = String(id)
    req.flush({
      items: [{ id: 3, content: '3' }, { id: 30, content: '30' }],
      total: 2,
      hasMore: false,
      nextOffset: 2,
    });
  });

  it("должен запрашивать выбранные элементы с правильными параметрами", () => {
    service.getItems('selected', 20, 20).subscribe();

    const req = httpMock.expectOne(r => r.url.endsWith('/selected'));
    expect(req.request.params.get('offset')).toBe('20');
    expect(req.request.params.get('q')).toBeNull(); // не передаётся при пустом q

    req.flush({ items: [], total: 0, hasMore: false, nextOffset: 0 });
  });

  it('должен отправлять POST-запрос при выборе элемента', () => {
    service.selectItem(5).subscribe();

    const req = httpMock.expectOne('/api/items/select');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ id: 5 });
    req.flush({ selected: true, id: 5 });
  });
});
