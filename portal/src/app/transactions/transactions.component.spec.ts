import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AccountSummary, Page, TransactionFilters, TransactionView } from '../core/api.models';
import { AccountsService } from '../core/accounts.service';
import { SEARCH_DEBOUNCE_MS, TransactionsComponent } from './transactions.component';

describe('TransactionsComponent', () => {
  const account: AccountSummary = {
    id: 1, maskedNumber: '•••• 1234', type: 'CHECKING', currency: 'GBP', balance: '5309.01', status: 'ACTIVE', openedAt: '2026-08-01T09:00:00Z',
  };
  const tesco: TransactionView = {
    id: 7, postedAt: '2026-09-05T10:00:00Z', direction: 'DEBIT', amount: '12.50', signedAmount: '-12.50',
    description: 'Card payment to Tesco', merchant: 'Tesco', category: 'GROCERIES', balanceAfter: '100.00',
  };
  const noFilters: Required<TransactionFilters> = { from: '', to: '', direction: '', q: '' };
  const pageOf = (content: TransactionView[], pageNo = 0): Page<TransactionView> => ({
    content,
    page: pageNo,
    size: 20,
    totalElements: content.length ? 41 : 0,
    totalPages: content.length ? 3 : 0,
  });

  let api: jasmine.SpyObj<AccountsService>;
  let fixture: ComponentFixture<TransactionsComponent>;
  let el: HTMLElement;

  beforeEach(() => {
    api = jasmine.createSpyObj<AccountsService>('AccountsService', ['get', 'transactions', 'allTransactions']);
    api.get.and.returnValue(of(account));
    api.transactions.and.callFake((_id: number, _filters: unknown, p: number) => of(pageOf([tesco], p)));
    TestBed.configureTestingModule({
      imports: [TransactionsComponent],
      providers: [
        provideRouter([]),
        { provide: AccountsService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '1' })) } },
      ],
    });
  });

  function render(): void {
    fixture = TestBed.createComponent(TransactionsComponent);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  function type(selector: string, value: string): void {
    const input = el.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function choose(selector: string, value: string): void {
    const select = el.querySelector<HTMLSelectElement>(selector)!;
    select.value = value;
    select.dispatchEvent(new Event('change'));
  }

  it('loads the account and the first page from the server, newest first', () => {
    render();
    expect(api.get).toHaveBeenCalledWith(1);
    expect(api.transactions).toHaveBeenCalledOnceWith(1, noFilters, 0, 20);
    expect(el.querySelector('h1')?.textContent).toContain('Current account •••• 1234');
    expect(el.querySelector('tbody tr')?.textContent).toContain('Card payment to Tesco');
    expect(el.querySelector('tbody td.num')?.textContent).toContain('-£12.50');
    expect(el.querySelector('.pager')?.textContent).toContain('Page 1 of 3');
  });

  it('waits until typing stops before searching (one request, not one per key)', fakeAsync(() => {
    render();
    api.transactions.calls.reset();

    type('#q', 't');
    tick(100);
    type('#q', 'tes');
    tick(100);
    type('#q', 'tesco');
    tick(SEARCH_DEBOUNCE_MS - 1);
    expect(api.transactions).not.toHaveBeenCalled();

    tick(1);
    expect(api.transactions).toHaveBeenCalledOnceWith(1, { ...noFilters, q: 'tesco' }, 0, 20);
  }));

  it('does not search again when the text only changed by spaces', fakeAsync(() => {
    render();
    type('#q', 'tesco');
    tick(SEARCH_DEBOUNCE_MS);
    api.transactions.calls.reset();

    type('#q', 'tesco  ');
    tick(SEARCH_DEBOUNCE_MS);
    expect(api.transactions).not.toHaveBeenCalled();
  }));

  it('searches at once on Enter', () => {
    render();
    type('#q', 'tesco');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    expect(api.transactions).toHaveBeenCalledWith(1, { ...noFilters, q: 'tesco' }, 0, 20);
  });

  it('applies money in/out and dates straight away, from the first page', () => {
    render();
    choose('#direction', 'DEBIT');
    expect(api.transactions).toHaveBeenCalledWith(1, { ...noFilters, direction: 'DEBIT' as const }, 0, 20);

    type('#from', '2026-09-01');
    expect(api.transactions).toHaveBeenCalledWith(1, { ...noFilters, direction: 'DEBIT' as const, from: '2026-09-01' }, 0, 20);
  });

  it('refuses a date range that ends before it starts, without calling the server', () => {
    render();
    api.transactions.calls.reset();
    type('#from', '2026-09-10');
    api.transactions.calls.reset();
    type('#to', '2026-09-01');
    fixture.detectChanges();

    expect(api.transactions).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('must be on or before');
  });

  it('pages forward, and a new filter goes back to page 1', () => {
    render();
    const next = Array.from(el.querySelectorAll<HTMLButtonElement>('.pager button')).find((b) => b.textContent?.includes('Next'))!;
    next.click();
    fixture.detectChanges();
    expect(api.transactions).toHaveBeenCalledWith(1, noFilters, 1, 20);
    expect(el.querySelector('.pager')?.textContent).toContain('Page 2 of 3');

    choose('#direction', 'CREDIT');
    expect(api.transactions.calls.mostRecent().args[2]).toBe(0);
  });

  it('says so when nothing matches', () => {
    api.transactions.and.returnValue(of(pageOf([])));
    render();
    expect(el.querySelector('table')).toBeNull();
    expect(el.textContent).toContain('No transactions match these filters.');
  });

  it("shows the API's message when the account isn't the customer's (404)", () => {
    const notFound = new HttpErrorResponse({ status: 404, error: { title: 'Account not found', detail: 'Account 1 not found' } });
    api.get.and.returnValue(throwError(() => notFound));
    api.transactions.and.returnValue(throwError(() => notFound));
    render();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Account 1 not found');
  });

  it('keeps working after a failed request', () => {
    api.transactions.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    render();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Something went wrong on our side');

    api.transactions.and.callFake((_id: number, _f: unknown, p: number) => of(pageOf([tesco], p)));
    choose('#direction', 'DEBIT');
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.querySelector('tbody tr')?.textContent).toContain('Tesco');
  });
});
