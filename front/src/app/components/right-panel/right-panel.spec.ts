import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { RightPanel } from './right-panel';
import { Items } from '../../services/items';
import { ItemsSync } from '../../services/items-sync';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('RightPanel', () => {
  let component: RightPanel;
  let fixture: ComponentFixture<RightPanel>;
  let itemsServiceSpy: jasmine.SpyObj<Items>;

  const mockItems = [
    { id: 3, content: '3' },
    { id: 4, content: '4' },
  ];

  beforeEach(async () => {
    itemsServiceSpy = jasmine.createSpyObj<Items>(
      'Items',
      ['getItems', 'deselectItem', 'reorder'],
    );

    itemsServiceSpy.getItems.and.returnValue(of({
      items: mockItems, total: 5, hasMore: true, nextOffset: 2,
    }));
    itemsServiceSpy.deselectItem.and.returnValue(of({ deselected: true, id: 3 }));
    itemsServiceSpy.reorder.and.returnValue(of({ ok: true }));

    await TestBed.configureTestingModule({
      imports: [RightPanel],
      providers: [
        provideHttpClientTesting(),
        { provide: Items, useValue: itemsServiceSpy },
        ItemsSync,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RightPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('загружает выбранные элементы при инициализации', () => {
    expect(itemsServiceSpy.getItems).toHaveBeenCalledWith('selected', 0, 20, '');
    expect(component.items()).toEqual(mockItems);
  });

  it('deselectItem шлёт запрос и удаляет локально', () => {
    component.deselectItem(mockItems[0]);
    expect(itemsServiceSpy.deselectItem).toHaveBeenCalledWith(3);
    expect(component.items().find(x => x.id === 3)).toBeUndefined();
  });
});
