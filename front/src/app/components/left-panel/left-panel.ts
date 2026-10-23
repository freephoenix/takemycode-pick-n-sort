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
import { Subscription } from 'rxjs';
import { Items, PageResponse } from '../../services/items';
import { ItemsSync } from '../../services/items-sync';

@Component({
  selector: 'app-left-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, ScrollingModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './left-panel.html',
  styleUrls: ['../panel-shared.css', './left-panel.css'],
})
export class LeftPanel implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(CdkVirtualScrollViewport)
  viewport!: CdkVirtualScrollViewport;
  items = signal<number[]>([]);
  total = signal(0);
  hasMore = signal(true);
  loading = signal(false);
  filterQuery = signal('');
  newId = signal<number | null>(null);
  private itemsService = inject(Items);
  private sync = inject(ItemsSync);
  private nextOffset = 0;
  private loadedOnce = false;
  private readonly PAGE_SIZE = 20;
  private syncSub?: Subscription;

  ngOnInit() {
    this.loadMore();
    this.syncSub = this.sync.changes.subscribe((event) => {
      if (event.type === 'selected') this.onSyncSelected(event.id);
      else if (event.type === 'deselected') this.onSyncDeselected(event.id);
    });
  }

  ngAfterViewInit() {
    // Если первая порция не заполнила viewport — догрузим
    setTimeout(() => this.checkScroll());
  }

  ngOnDestroy() {
    this.syncSub?.unsubscribe();
  }

  /** Вызывается из шаблона на scrolledIndexChange И на нативный scroll */
  onScrolled() {
    this.checkScroll();
  }

  loadMore() {
    if (this.loading()) return;
    if (this.loadedOnce && !this.hasMore()) return;

    this.loading.set(true);
    this.itemsService
      .getItems('unselected', this.nextOffset, this.PAGE_SIZE, this.filterQuery())
      .subscribe({
        next: (res: PageResponse<number>) => {
          this.items.update(prev => [...prev, ...res.items]);
          this.total.set(res.total);

          // Fallback: если сервер не прислал hasMore/nextOffset
          const computedNext = res.nextOffset ?? (this.nextOffset + res.items.length);
          const computedHasMore = res.hasMore ?? (computedNext < res.total);

          this.nextOffset = computedNext;
          this.hasMore.set(computedHasMore);
          this.loadedOnce = true;
          this.loading.set(false);
          setTimeout(() => this.checkScroll());
        },
        error: (err: Error) => {
          console.error('left loadMore failed', err);
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

  selectItem(id: number) {
    this.itemsService.selectItem(id).subscribe(() => this.sync.notify(id, 'selected'));
  }

  addItem() {
    const id = this.newId();
    if (id == null || !Number.isInteger(id)) return;
    this.itemsService.addItem(id).subscribe(() => {
      this.nextOffset = 0;
      this.items.set([]);
      this.hasMore.set(true);
      this.loadedOnce = false;
      this.loadMore();
      this.newId.set(null);
    });
  }

  updateFilter(value: string) {
    this.filterQuery.set(value);
    this.applyFilter();
  }

  updateNewId(value: string) {
    const num = parseInt(value, 10);
    this.newId.set(isNaN(num) ? null : num);
  }

  private checkScroll() {
    if (!this.viewport || this.loading()) return;
    if (this.loadedOnce && !this.hasMore()) return;

    // Проверка 1: расстояние до конца контента в пикселях
    const fromBottom = this.viewport.measureScrollOffset('bottom');

    // Проверка 2: последний отрендеренный индекс против длины данных
    const range = this.viewport.getRenderedRange();
    const dataLength = this.items().length;
    const nearEnd = dataLength > 0 && range.end >= dataLength - 2;

    if (fromBottom < 200 || nearEnd) {
      this.loadMore();
    }
  }

  private onSyncSelected(id: number) {
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

  private onSyncDeselected(id: number) {
    const filter = this.filterQuery();
    if (filter && !String(id).includes(filter)) return;

    const items = this.items();
    const pos = this.findInsertPosition(items, id);
    const wasFullyLoaded = !this.hasMore();

    if (pos < items.length || wasFullyLoaded) {
      this.items.update(prev => [...prev.slice(0, pos), id, ...prev.slice(pos)]);
      this.nextOffset += 1;
    }
    this.total.update(t => t + 1);
    this.hasMore.set(this.nextOffset < this.total());
  }

  private findInsertPosition(sorted: number[], id: number): number {
    let lo = 0, hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < id) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
}
