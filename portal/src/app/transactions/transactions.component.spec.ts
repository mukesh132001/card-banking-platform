import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AccountSummary, Page, TransactionView } from '../core/api.models';
import { AccountsService } from '../core/accounts.service';
import { TransactionsComponent } from './transactions.component';

describe('TransactionsComponent', () => {
  const account: AccountSummary = {
    id: 1, maskedNumber: '•••• 1234', type: 'CHECKING', currency: 'GBP', balance: 5309.01, status: 'ACTIVE', openedAt: '2026-08-01T09:00:00Z',
  };
  const tesco: TransactionView = {
    id: 7, postedAt: '2026-09-05T10:00:00Z', direction: 'DEBIT', amount: 12.5, signedAmount: -12.5,
    description: 'Card payment to Tesco', merchant: 'Tesco', category: 'GROCERIES', balanceAfter: 100,
  };
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
    fixture = TestBed.createComponent(TransactionsComponent);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  function submitFilters(): void {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('loads the account and the first page, newest first', () => {
    expect(api.get).toHaveBeenCalledWith(1);
    expect(api.transactions).toHaveBeenCalledWith(1, { from: '', to: '', direction: '', q: '' }, 0, 20);
    expect(el.querySelector('h1')?.textContent).toContain('Current account •••• 1234');
    expect(el.querySelector('tbody tr')?.textContent).toContain('Card payment to Tesco');
    expect(el.querySelector('tbody td.num')?.textContent).toContain('-£12.50');
    expect(el.querySelector('.pager')?.textContent).toContain('Page 1 of 3');
  });

  it('sends the filters and starts again from the first page', () => {
    const q = el.querySelector<HTMLInputElement>('#q')!;
    q.value = 'tesco';
    q.dispatchEvent(new Event('input'));
    const direction = el.querySelector<HTMLSelectElement>('#direction')!;
    direction.value = 'DEBIT';
    direction.dispatchEvent(new Event('change'));
    submitFilters();

    expect(api.transactions).toHaveBeenCalledWith(1, { from: '', to: '', direction: 'DEBIT', q: 'tesco' }, 0, 20);
  });

  it('pages forward', () => {
    const next = Array.from(el.querySelectorAll<HTMLButtonElement>('.pager button')).find((b) =>
      b.textContent?.includes('Next'),
    )!;
    next.click();
    fixture.detectChanges();

    expect(api.transactions).toHaveBeenCalledWith(1, jasmine.any(Object), 1, 20);
    expect(el.querySelector('.pager')?.textContent).toContain('Page 2 of 3');
  });

  it('says so when nothing matches', () => {
    api.transactions.and.returnValue(of(pageOf([])));
    submitFilters();

    expect(el.querySelector('table')).toBeNull();
    expect(el.textContent).toContain('No transactions match these filters.');
  });
});
