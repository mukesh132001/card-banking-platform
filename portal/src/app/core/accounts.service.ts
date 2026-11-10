import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, reduce } from 'rxjs';

import { AccountSummary, Page, TransactionFilters, TransactionView } from './api.models';

/** Safety cap for exports: 50 pages x 100 = 5,000 transactions. */
const MAX_EXPORT_PAGES = 50;

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly http = inject(HttpClient);

  list(): Observable<AccountSummary[]> {
    return this.http.get<AccountSummary[]>('/api/accounts');
  }

  get(accountId: number): Observable<AccountSummary> {
    return this.http.get<AccountSummary>(`/api/accounts/${accountId}`);
  }

  transactions(accountId: number, filters: TransactionFilters, page: number, size: number): Observable<Page<TransactionView>> {
    let params = new HttpParams().set('page', page).set('size', size);
    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === 'string' && value.trim() !== '') {
        params = params.set(key, value.trim());
      }
    }
    return this.http.get<Page<TransactionView>>(`/api/accounts/${accountId}/transactions`, { params });
  }

  /** Every transaction matching the filters, fetched 100 at a time (for CSV export). */
  allTransactions(accountId: number, filters: TransactionFilters): Observable<TransactionView[]> {
    return this.transactions(accountId, filters, 0, 100).pipe(
      expand((p) =>
        p.page + 1 < p.totalPages && p.page + 1 < MAX_EXPORT_PAGES
          ? this.transactions(accountId, filters, p.page + 1, 100)
          : EMPTY,
      ),
      reduce((all, p) => all.concat(p.content), [] as TransactionView[]),
    );
  }
}
