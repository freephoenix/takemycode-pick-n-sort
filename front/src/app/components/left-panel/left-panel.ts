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
import { Item, Items } from '../../services/items';
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
  items = signal<Item[]>([]);
  total = signal(0);
  hasMore = signal(true);
  loading = signal(false);
  filterQuery = signal('');
  newContent = signal('');
  pendingMessage = signal<string | null>(null);
  private itemsService = inject(Items);
  private sync = inject(ItemsSync);
  private nextOffset = 0;
  private loadedOnce = false;
  private readonly PAGE_SIZE = 20;
  private readonly FILTER_DEBOUNCE_MS = 250;
  private syncSub?: Subscription;
  private loadSub?: Subscription;
  private pendingTimer?: ReturnType<typeof setTimeout>;
  private filterDebounce?: ReturnType<typeof setTimeout>;

  readonly trackById = (_: number, item: Item) => item.id;

  ngOnInit() {
    this.loadMore();
    this.syncSub = this.sync.changes.subscribe((event) => {
      if (event.type === 'selected') this.onSyncSelected(event.item);
      else if (event.type === 'deselected') this.onSyncDeselected(event.item);
    });
  }

  ngAfterViewInit() {
    setTimeout(() => this.checkScroll());
  }

  ngOnDestroy() {
    this.syncSub?.unsubscribe();
    this.loadSub?.unsubscribe();
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
    }
    if (this.filterDebounce) {
      clearTimeout(this.filterDebounce);
    }
  }

  onScrolled() {
    this.checkScroll();
  }

  loadMore() {
    if (this.loading()) return;
    if (this.loadedOnce && !this.hasMore()) return;

    this.loading.set(true);
    this.loadSub = this.itemsService
      .getItems('unselected', this.nextOffset, this.PAGE_SIZE, this.filterQuery())
      .subscribe({
        next: (res) => {
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
        error: (err) => {
          console.error('[left] loadMore failed', err);
          this.loading.set(false);
        },
      });
  }

  applyFilter() {
    this.loadSub?.unsubscribe();
    this.loadSub = undefined;
    this.loading.set(false);
    this.nextOffset = 0;
    this.items.set([]);
    this.hasMore.set(true);
    this.loadedOnce = false;
    this.loadMore();
  }

  selectItem(item: Item) {
    this.itemsService.selectItem(item.id).subscribe(() => this.sync.notify('selected', item));
  }

  addItem() {
    const content = this.newContent().trim();
    if (!content) return;

    this.itemsService.addItem(content).subscribe({
      next: (res) => {
        this.newContent.set('');
        if (res.queued) {
          this.pendingMessage.set(`"${content}" в очереди, появится в течение 10 с`);
          if (this.pendingTimer) clearTimeout(this.pendingTimer);
          // После flush (10 с) — автофильтр по новому контенту,
          // чтобы пользователь сразу увидел добавленный элемент.
          this.pendingTimer = setTimeout(() => {
            this.filterQuery.set(content);
            this.applyFilter();
            this.pendingMessage.set(null);
          }, 10_500);
        } else {
          this.pendingMessage.set(
            res.reason === 'exists'
              ? `"${content}" уже существует`
              : `"${content}" уже в очереди`,
          );
        }
      },
      error: (err) => {
        console.error('[left] addItem failed', err);
        this.pendingMessage.set('Ошибка добавления');
      },
    });
  }

  updateFilter(value: string) {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = undefined;
    }
    this.pendingMessage.set(null);
    this.filterQuery.set(value);

    if (this.filterDebounce) {
      clearTimeout(this.filterDebounce);
    }
    this.filterDebounce = setTimeout(() => {
      this.applyFilter();
      this.filterDebounce = undefined;
    }, this.FILTER_DEBOUNCE_MS);
  }

  updateNewContent(value: string) {
    this.newContent.set(value);
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

  private onSyncSelected(item: Item) {
    const filter = this.filterQuery();
    const matches = !filter || item.content.toLowerCase().includes(filter.toLowerCase());
    if (!matches) return;

    const idx = this.items().findIndex(x => x.id === item.id);
    if (idx !== -1) {
      this.items.update(prev => prev.filter(x => x.id !== item.id));
      this.nextOffset = Math.max(0, this.nextOffset - 1);
    }
    this.total.update(t => t - 1);
    this.hasMore.set(this.nextOffset < this.total());
  }

  private onSyncDeselected(item: Item) {
    const filter = this.filterQuery();
    const matches = !filter || item.content.toLowerCase().includes(filter.toLowerCase());
    if (!matches) return;

    const items = this.items();
    const pos = this.findInsertPosition(items, item);
    const wasFullyLoaded = !this.hasMore();

    if (pos < items.length || wasFullyLoaded) {
      this.items.update(prev => [...prev.slice(0, pos), item, ...prev.slice(pos)]);
      this.nextOffset += 1;
    }
    this.total.update(t => t + 1);
    this.hasMore.set(this.nextOffset < this.total());
  }

  /** Бинарный поиск позиции вставки: элементы отсортированы по ID */
  private findInsertPosition(sorted: Item[], item: Item): number {
    let lo = 0, hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid].id < item.id) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
}
