import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

type ItemChangeType = 'selected' | 'deselected'
export type ItemChange = { id: number; type: ItemChangeType };

@Injectable({providedIn: 'root'})
export class ItemsSync {
  private readonly changes$ = new Subject<ItemChange>();
  readonly changes = this.changes$.asObservable();

  notify(id: number, type: ItemChangeType) {
    this.changes$.next({id, type});
  }
}
