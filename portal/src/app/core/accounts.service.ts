import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';

import { AccountSummary, Page, TransactionFilters, TransactionView } from './api.models';
import { toMoney } from './money';

/** Safety cap for exports: 50 pages x 100 = 5,000 transactions. */
const MAX_EXPORT_PAGES = 50;

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly http = inject(HttpClient);

  list(): Observable<AccountSummary[]> {
    return this.http.get<AccountSummary[]>('/api/accounts').pipe(map((list) => list.map(normalizeAccount)));
  }

  get(accountId: number): Observable<AccountSummary> {
    return this.http.get<AccountSummary>(`/api/accounts/${accountId}`).pipe(map(normalizeAccount));
  }

  /** One page, filtered and paged on the server. Blank filters are left out of the query string. */
  transactions(accountId: number, filters: TransactionFilters, page: number, size: number): Observable<Page<TransactionView>> {
    let params = new HttpParams().set('page', page).set('size', size);
    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === 'string' && value.trim() !== '') {
        params = params.set(key, value.trim());
      }
    }
    return this.http
      .get<Page<TransactionView>>(`/api/accounts/${accountId}/transactions`, { params })
      .pipe(map((p) => ({ ...p, content: p.content.map(normalizeTransaction) })));
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

/** Money must be a decimal string; an older API that sent JSON numbers still works. */
function normalizeAccount(a: AccountSummary): AccountSummary {
  return { ...a, balance: toMoney(a.balance) };
}

function normalizeTransaction(t: TransactionView): TransactionView {
  return {
    ...t,
    amount: toMoney(t.amount),
    signedAmount: toMoney(t.signedAmount),
    balanceAfter: toMoney(t.balanceAfter),
  };
}
