import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PageResponse<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextOffset: number;
}

@Injectable({providedIn: 'root'})
export class Items {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  getItems(type: string, offset: number, limit = 20, q = ''): Observable<PageResponse<number>> {
    let params = new HttpParams().set('offset', offset).set('limit', limit);
    if (q) params = params.set('q', q);
    console.log(`${this.baseUrl}/${type}`);
    return this.http.get<PageResponse<number>>(`${this.baseUrl}/${type}`, {params});
  }

  addItem(id: number): Observable<{ queued: boolean; id: number }> {
    return this.http.post<{ queued: boolean; id: number }>(`${this.baseUrl}/add`, {id});
  }

  selectItem(id: number): Observable<{ selected: boolean; id: number }> {
    return this.http.post<{ selected: boolean; id: number }>(`${this.baseUrl}/select`, {id});
  }

  deselectItem(id: number): Observable<{ deselected: boolean; id: number }> {
    return this.http.post<{ deselected: boolean; id: number }>(`${this.baseUrl}/deselect`, {id});
  }

  reorder(itemId: number, beforeId: number | null, afterId: number | null) {
    return this.http.put<{ ok: boolean }>(
      `${this.baseUrl}/reorder`,
      {itemId, beforeId, afterId},
    );
  }

  getState(): Observable<{ selectedOrder: number[]; selectedCount: number }> {
    return this.http.get<{ selectedOrder: number[]; selectedCount: number }>(`${this.baseUrl}/state`);
  }
}
