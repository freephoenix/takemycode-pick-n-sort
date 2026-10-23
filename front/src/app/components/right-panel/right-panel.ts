import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Subscription } from 'rxjs';
import { Items, PageResponse } from '../../services/items';
import { ItemsSync } from '../../services/items-sync';

@Component({
  selector: 'app-right-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, ScrollingModule, DragDropModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './right-panel.html',
  styleUrls: ['../panel-shared.css', './right-panel.css'],
})
export class RightPanel implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(CdkVirtualScrollViewport)
  viewport!: CdkVirtualScrollViewport;
  items = signal<number[]>([]);
  total = signal(0);
  hasMore = signal(true);
  loading = signal(false);
  filterQuery = signal('');
  private itemsService = inject(Items);
  private sync = inject(ItemsSync);
  private nextOffset = 0;
  private loadedOnce = false;
  private readonly PAGE_SIZE = 20;
  private syncSub?: Subscription;

  readonly trackById = (_: number, id: number) => id;

  ngOnInit() {
    this.loadMore();
    this.syncSub = this.sync.changes.subscribe((event) => {
      if (event.type === 'selected') this.onSyncSelected(event.id);
      else if (event.type === 'deselected') this.onSyncDeselected(event.id);
    });
  }

  ngAfterViewInit() {
    setTimeout(() => this.checkScroll());
  }

  ngOnDestroy() {
    this.syncSub?.unsubscribe();
  }

  onScrolled() {
    this.checkScroll();
  }

  loadMore() {
    if (this.loading()) return;
    if (this.loadedOnce && !this.hasMore()) return;

    this.loading.set(true);
    this.itemsService
      .getItems('selected', this.nextOffset, this.PAGE_SIZE, this.filterQuery())
      .subscribe({
        next: (res: PageResponse<number>) => {
          this.items.update(prev => [...prev, ...res.items]);
          this.total.set(res.total);

          const computedNext = res.nextOffset ?? (this.nextOffset + res.items.length);
          const computedHasMore = res.hasMore ?? (computedNext < res.total);

          this.nextOffset = computedNext;
          this.hasMore.set(computedHasMore);
          this.loadedOnce = true;
          this.loading.set(false);
          setTimeout(() => this.checkScroll());
        },
        error: (err: Error) => {
          console.error('[right] loadMore failed', err);
          this.loading.set(false);
        },
      });
  }

  applyFilter() {
    this.nextOffset = 0;
    this.items.set([]);
    this.hasMore.set(true);
    this.loadedOnce = false;
    this.loadMore();
  }

  deselectItem(id: number) {
    this.itemsService.deselectItem(id).subscribe(() => this.sync.notify(id, 'deselected'));
  }

  /**
   * Drag&Drop с поддержкой фильтра и виртуального скролла.
   *
   * 1. Восстанавливаем РЕАЛЬНЫЕ индексы в отфильтрованном массиве
   *    (CDK с виртуальным скроллом отдаёт индексы в отрендеренном окне).
   * 2. Локально переставляем отфильтрованный массив.
   * 3. По новой позиции вычисляем ЯКОРЬ (сосед сверху/снизу) и
   *    отправляем на сервер ID + якорь. Сервер переставляет в ПОЛНОМ
   *    selectedOrder по ID — фильтр клиента ему не важен.
   */
  drop(event: CdkDragDrop<number[], number[], [number, number]>) {
    // 1. Реальный previousIndex из cdkDragData
    const [, realPrevIndex] = event.item.data;
    event.previousIndex = realPrevIndex;

    // 2. Реальный currentIndex из data-drag-index на drop-цели
    const containerEl = event.container.element.nativeElement as HTMLElement;
    const dropTarget = containerEl.getElementsByClassName('cdk-drag')[event.currentIndex];
    const realCurrentIndexStr = dropTarget?.getAttribute('data-drag-index');
    if (realCurrentIndexStr != null) {
      event.currentIndex = Number(realCurrentIndexStr);
    }

    if (event.previousIndex === event.currentIndex) return;

    // 3. Локальная перестановка отфильтрованного массива
    const arr = [...this.items()];
    moveItemInArray(arr, event.previousIndex, event.currentIndex);
    this.items.set(arr);

    // 4. Вычисляем якорь по НОВОЙ позиции в отфильтрованном массиве
    const movedId = arr[event.currentIndex];
    const afterId = event.currentIndex > 0 ? arr[event.currentIndex - 1] : null;
    const beforeId = event.currentIndex === 0 && arr.length > 1 ? arr[1] : null;

    // 5. Отправляем ID + якорь. Индексы в полном списке вычисляет сервер
    this.itemsService.reorder(movedId, beforeId, afterId).subscribe({
      error: (err: Error) => {
        console.error('[right] reorder failed, refetch', err);
        this.applyFilter(); // при ошибке откатываемся к данным с сервера
      },
    });
  }

  updateFilter(value: string) {
    this.filterQuery.set(value);
    this.applyFilter();
  }

  private checkScroll() {
    if (!this.viewport || this.loading()) return;
    if (this.loadedOnce && !this.hasMore()) return;

    const fromBottom = this.viewport.measureScrollOffset('bottom');
    const range = this.viewport.getRenderedRange();
    const dataLength = this.items().length;
    const nearEnd = dataLength > 0 && range.end >= dataLength - 2;

    if (fromBottom < 200 || nearEnd) this.loadMore();
  }

  private onSyncSelected(id: number) {
    const filter = this.filterQuery();
    if (filter && !String(id).includes(filter)) return;

    this.total.update(t => t + 1);
    if (!this.hasMore()) {
      this.items.update(prev => [...prev, id]);
      this.nextOffset += 1;
    }
    this.hasMore.set(this.nextOffset < this.total());
  }

  private onSyncDeselected(id: number) {
    const filter = this.filterQuery();
    if (filter && !String(id).includes(filter)) return;

    const idx = this.items().indexOf(id);
    if (idx !== -1) {
      this.items.update(prev => prev.filter(x => x !== id));
      this.nextOffset = Math.max(0, this.nextOffset - 1);
    }
    this.total.update(t => t - 1);
    this.hasMore.set(this.nextOffset < this.total());
  }
}
