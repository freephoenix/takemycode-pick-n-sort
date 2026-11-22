import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Item } from './items';

type ItemChangeType = 'selected' | 'deselected'
export type ItemChange = { type: ItemChangeType; item: Item };

@Injectable({providedIn: 'root'})
export class ItemsSync {
  private readonly changes$ = new Subject<ItemChange>();
  readonly changes = this.changes$.asObservable();

  notify(type: ItemChangeType, item: Item) {
    this.changes$.next({type, item});
  }
}
