import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AccountSummary, Page, TransactionView } from './api.models';
import { AccountsService } from './accounts.service';

describe('AccountsService', () => {
  let service: AccountsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AccountsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists accounts, keeping money as exact strings', () => {
    let result: AccountSummary[] = [];
    service.list().subscribe((list) => (result = list));
    http.expectOne('/api/accounts').flush([{ id: 1, balance: '5309.01' }]);
    expect(result[0].balance).toBe('5309.01');
  });

  it('still works if an older API sends money as JSON numbers', () => {
    let result: AccountSummary | undefined;
    service.get(1).subscribe((a) => (result = a));
    http.expectOne('/api/accounts/1').flush({ id: 1, balance: 13084 });
    expect(result?.balance).toBe('13084');
  });

  it('sends paging and only the filters that are filled in', () => {
    service.transactions(1, { from: '2026-09-01', to: '', direction: 'DEBIT', q: '  tesco ' }, 2, 20).subscribe();
    const req = http.expectOne((r) => r.url === '/api/accounts/1/transactions');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.get('from')).toBe('2026-09-01');
    expect(req.request.params.has('to')).toBeFalse();
    expect(req.request.params.get('direction')).toBe('DEBIT');
    expect(req.request.params.get('q')).toBe('tesco');
    req.flush({ content: [], page: 2, size: 20, totalElements: 0, totalPages: 0 });
  });

  it('fetches every page for an export', () => {
    const row = (id: number) => ({ id, signedAmount: '-1.00', amount: '1.00', balanceAfter: '0.00' }) as TransactionView;
    let rows: TransactionView[] = [];
    service.allTransactions(1, {}).subscribe((r) => (rows = r));

    const page = (n: number): Page<TransactionView> => ({ content: [row(n)], page: n, size: 100, totalElements: 2, totalPages: 2 });
    http.expectOne((r) => r.params.get('page') === '0').flush(page(0));
    http.expectOne((r) => r.params.get('page') === '1').flush(page(1));
    expect(rows.map((r) => r.id)).toEqual([0, 1]);
  });
});
