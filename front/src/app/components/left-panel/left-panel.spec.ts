import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LeftPanel } from './left-panel';
import { Items } from '../../services/items';
import { ItemsSync } from '../../services/items-sync';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('LeftPanel', () => {
  let component: LeftPanel;
  let fixture: ComponentFixture<LeftPanel>;
  let itemsServiceSpy: jasmine.SpyObj<Items>;

  // content = String(id) — те же значения, что у сервера
  const mockItems = [
    { id: 1, content: '1' },
    { id: 2, content: '2' },
  ];

  beforeEach(async () => {
    itemsServiceSpy = jasmine.createSpyObj<Items>(
      'ItemsService',
      ['getItems', 'selectItem', 'addItem'],
    );
    itemsServiceSpy.getItems.and.returnValue(of({
      items: mockItems, total: 10, hasMore: true, nextOffset: 2,
    }));
    itemsServiceSpy.selectItem.and.returnValue(of({ selected: true, id: 1 }));
    itemsServiceSpy.addItem.and.returnValue(of({ queued: true, reason: 'queued' }));

    await TestBed.configureTestingModule({
      imports: [LeftPanel],
      providers: [
        provideHttpClientTesting(),
        { provide: Items, useValue: itemsServiceSpy },
        ItemsSync,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LeftPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('загружает элементы при инициализации', () => {
    expect(itemsServiceSpy.getItems).toHaveBeenCalledWith('unselected', 0, 20, '');
    expect(component.items()).toEqual(mockItems);
    expect(component.total()).toBe(10);
    expect(component.hasMore()).toBeTrue();
  });

  it('selectItem шлёт запрос и эмитит событие', () => {
    component.selectItem(mockItems[0]);
    expect(itemsServiceSpy.selectItem).toHaveBeenCalledWith(1);
    // после ответа сервиса элемент должен исчезнуть локально
    expect(component.items().find(x => x.id === 1)).toBeUndefined();
  });
});
