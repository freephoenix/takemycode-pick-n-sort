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
import { Item, Items } from '../../services/items';
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
  items = signal<Item[]>([]);
  total = signal(0);
  hasMore = signal(true);
  loading = signal(false);
  filterQuery = signal('');
  private itemsService = inject(Items);
  private sync = inject(ItemsSync);
  private nextOffset = 0;
  private loadedOnce = false;
  private readonly PAGE_SIZE = 20;
  private readonly FILTER_DEBOUNCE_MS = 250;
  private syncSub?: Subscription;
  private loadSub?: Subscription;
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
      .getItems('selected', this.nextOffset, this.PAGE_SIZE, this.filterQuery())
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
          console.error('[right] loadMore failed', err);
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

  deselectItem(item: Item) {
    this.itemsService.deselectItem(item.id).subscribe(() => this.sync.notify('deselected', item));
  }

  drop(event: CdkDragDrop<Item[], Item[], [Item, number]>) {
    const [, realPrevIndex] = event.item.data;
    event.previousIndex = realPrevIndex;

    const containerEl = event.container.element.nativeElement as HTMLElement;
    const dropTarget = containerEl.getElementsByClassName('cdk-drag')[event.currentIndex];
    const realCurrentIndexStr = dropTarget?.getAttribute('data-drag-index');
    if (realCurrentIndexStr != null) {
      event.currentIndex = Number(realCurrentIndexStr);
    }

    if (event.previousIndex === event.currentIndex) return;

    const arr = [...this.items()];
    moveItemInArray(arr, event.previousIndex, event.currentIndex);
    this.items.set(arr);

    const movedItem = arr[event.currentIndex];
    const afterItem = event.currentIndex > 0 ? arr[event.currentIndex - 1] : null;
    const beforeItem = event.currentIndex === 0 && arr.length > 1 ? arr[1] : null;

    this.itemsService
      .reorder(movedItem.id, beforeItem?.id ?? null, afterItem?.id ?? null)
      .subscribe({
        error: (err) => {
          console.error('[right] reorder failed, refetch', err);
          this.applyFilter();
        },
      });
  }

  updateFilter(value: string) {
    this.filterQuery.set(value);

    if (this.filterDebounce) clearTimeout(this.filterDebounce);
    this.filterDebounce = setTimeout(() => {
      this.applyFilter();
      this.filterDebounce = undefined;
    }, this.FILTER_DEBOUNCE_MS);
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

    this.total.update(t => t + 1);
    if (!this.hasMore()) {
      this.items.update(prev => [...prev, item]);
      this.nextOffset += 1;
    }
    this.hasMore.set(this.nextOffset < this.total());
  }

  private onSyncDeselected(item: Item) {
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
}
