import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { App } from './app';

describe('App', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('должен создаваться', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();

    // Панели уже сделали запросы в ngOnInit — отвечаем пустым результатом
    httpMock.match(r =>
      r.url.endsWith('/unselected') || r.url.endsWith('/selected')
    ).forEach(req =>
      req.flush({ items: [], total: 0, hasMore: false, nextOffset: 0 })
    );
  });

  it('должен рендерить обе панели', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    httpMock.match(r =>
      r.url.endsWith('/unselected') || r.url.endsWith('/selected')
    ).forEach(req =>
      req.flush({ items: [], total: 0, hasMore: false, nextOffset: 0 })
    );

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-left-panel')).toBeTruthy();
    expect(compiled.querySelector('app-right-panel')).toBeTruthy();
  });
});
