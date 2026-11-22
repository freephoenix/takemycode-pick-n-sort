import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Item {
  id: number;
  content: string;
}

export interface PageResponse<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextOffset: number;
}

export type AddResult = {
  queued: boolean;
  reason: 'queued' | 'pending' | 'exists';
};

@Injectable({providedIn: 'root'})
export class Items {
  private http = inject(HttpClient);
  private baseUrl = '/api/items';

  getItems(type: string, offset: number, limit = 20, q = ''): Observable<PageResponse<Item>> {
    let params = new HttpParams().set('offset', offset).set('limit', limit);
    if (q) params = params.set('q', q);
    return this.http.get<PageResponse<Item>>(`${this.baseUrl}/${type}`, {params});
  }

  addItem(content: string): Observable<AddResult> {
    return this.http.post<AddResult>(`${this.baseUrl}/add`, {content});
  }

  selectItem(id: number) {
    return this.http.post<{ selected: boolean; id: number }>(`${this.baseUrl}/select`, {id});
  }

  deselectItem(id: number) {
    return this.http.post<{ deselected: boolean; id: number }>(`${this.baseUrl}/deselect`, {id});
  }

  reorder(itemId: number, beforeId: number | null, afterId: number | null) {
    return this.http.put<{ ok: boolean }>(
      `${this.baseUrl}/reorder`,
      {itemId, beforeId, afterId},
    );
  }

  getState() {
    return this.http.get<{ selectedOrder: number[]; selectedCount: number }>(`${this.baseUrl}/state`);
  }
}
