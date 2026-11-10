import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  Observable,
  Subject,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  merge,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import { ACCOUNT_TYPE_LABELS, AccountSummary, Direction, Page, TransactionFilters, TransactionView } from '../core/api.models';
import { AccountsService } from '../core/accounts.service';
import { downloadCsv, transactionsToCsv } from '../core/csv';
import { friendlyError } from '../core/errors';
import { MoneyPipe } from '../core/money.pipe';

export const PAGE_SIZE = 20;
/** Wait this long after the last keystroke before searching, so typing "tesco" sends 1 request, not 5. */
export const SEARCH_DEBOUNCE_MS = 300;

interface PageRequest {
  accountId: number;
  filters: Required<TransactionFilters>;
  page: number;
}

@Component({
  selector: 'app-transactions',
  imports: [ReactiveFormsModule, MoneyPipe, DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p><a routerLink="/accounts">← All accounts</a></p>
    @if (account(); as a) {
      <h1>{{ typeLabel(a) }} {{ a.maskedNumber }}</h1>
      <p class="total">Balance <strong>{{ a.balance | money: a.currency }}</strong></p>
    } @else {
      <h1>Transactions</h1>
    }

    <form class="filters" [formGroup]="filters" (ngSubmit)="searchNow()" aria-label="Filter transactions">
      <div>
        <label for="from">From</label>
        <input id="from" type="date" formControlName="from" />
      </div>
      <div>
        <label for="to">To</label>
        <input id="to" type="date" formControlName="to" />
      </div>
      <div>
        <label for="direction">Type</label>
        <select id="direction" formControlName="direction">
          <option value="">All</option>
          <option value="CREDIT">Money in</option>
          <option value="DEBIT">Money out</option>
        </select>
      </div>
      <div class="grow">
        <label for="q">Search</label>
        <input id="q" type="search" formControlName="q" placeholder="Merchant or description" maxlength="100"
               aria-describedby="q-hint" />
        <span id="q-hint" class="visually-hidden">Results update as you type.</span>
      </div>
      <div class="actions">
        <button type="button" (click)="clear()">Clear</button>
        <button type="button" (click)="exportCsv()" [disabled]="exporting() || !page()?.totalElements">
          {{ exporting() ? 'Exporting…' : 'Export CSV' }}
        </button>
      </div>
    </form>

    <div aria-live="polite">
      @if (error(); as message) {
        <p class="alert" role="alert">{{ message }}</p>
      }
      @if (loading() && page()) {
        <p class="muted">Updating…</p>
      }
    </div>

    @if (page(); as p) {
      @if (p.totalElements === 0) {
        <p class="muted">No transactions match these filters.</p>
      } @else {
        <table class="transactions" [attr.aria-busy]="loading()">
          <caption class="visually-hidden">Transactions, newest first</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Description</th>
              <th scope="col">Category</th>
              <th scope="col" class="num">Amount</th>
              <th scope="col" class="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            @for (t of p.content; track t.id) {
              <tr>
                <td>{{ t.postedAt | date: 'd MMM y, HH:mm' }}</td>
                <td>{{ t.description }}</td>
                <td>{{ t.category ?? '' }}</td>
                <td class="num" [class.credit]="t.direction === 'CREDIT'">{{ t.signedAmount | money: currency() }}</td>
                <td class="num">{{ t.balanceAfter | money: currency() }}</td>
              </tr>
            }
          </tbody>
        </table>
        <nav class="pager" aria-label="Pages">
          <button type="button" (click)="goTo(p.page - 1)" [disabled]="p.page === 0 || loading()">Previous</button>
          <span>Page {{ p.page + 1 }} of {{ p.totalPages }} · {{ p.totalElements }} transactions</span>
          <button type="button" (click)="goTo(p.page + 1)" [disabled]="p.page + 1 >= p.totalPages || loading()">Next</button>
        </nav>
      }
    } @else if (!error()) {
      <p class="muted">Loading transactions…</p>
    }
  `,
})
export class TransactionsComponent {
  private readonly api = inject(AccountsService);
  private readonly route = inject(ActivatedRoute);

  readonly filters = inject(NonNullableFormBuilder).group({
    from: [''],
    to: [''],
    direction: ['' as Direction | ''],
    q: [''],
  });

  readonly account = signal<AccountSummary | null>(null);
  readonly page = signal<Page<TransactionView> | null>(null);
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly error = signal<string | null>(null);

  /** Pager clicks. */
  private readonly pageClicks = new Subject<number>();
  /** Enter in the search box: search now instead of waiting for the debounce. */
  private readonly submits = new Subject<void>();
  private accountId = 0;

  constructor() {
    const accountId$ = this.route.paramMap.pipe(
      map((params) => Number(params.get('id'))),
      distinctUntilChanged(),
      tap((id) => this.openAccount(id)),
    );

    accountId$
      .pipe(
        // New account or new filters -> back to page 0; pager clicks move within the current filters.
        switchMap((accountId) =>
          this.filterChanges().pipe(
            switchMap((filters) =>
              this.pageClicks.pipe(
                startWith(0),
                map((page): PageRequest => ({ accountId, filters, page })),
              ),
            ),
          ),
        ),
        // switchMap cancels the in-flight request when a newer one starts, so a slow response for "tes"
        // can never overwrite the results for "tesco".
        switchMap((req) => this.fetch(req)),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        if (page) {
          this.page.set(page);
        }
        this.loading.set(false);
      });
  }

  currency(): string {
    return this.account()?.currency ?? 'GBP';
  }

  typeLabel(a: AccountSummary): string {
    return ACCOUNT_TYPE_LABELS[a.type] ?? a.type;
  }

  searchNow(): void {
    this.submits.next();
  }

  clear(): void {
    this.filters.reset();
    this.submits.next();
  }

  goTo(page: number): void {
    this.pageClicks.next(page);
  }

  exportCsv(): void {
    this.exporting.set(true);
    this.api.allTransactions(this.accountId, cleanFilters(this.filters.getRawValue())).subscribe({
      next: (rows) => {
        downloadCsv(`transactions-${this.account()?.maskedNumber.slice(-4) ?? this.accountId}.csv`, transactionsToCsv(rows));
        this.exporting.set(false);
      },
      error: (err: unknown) => {
        this.error.set(friendlyError(err, 'export'));
        this.exporting.set(false);
      },
    });
  }

  /**
   * The current filters, emitted whenever they change. Dates and money in/out apply at once; the search text
   * waits until typing pauses (debounceTime), or until Enter is pressed. Identical filters are not re-sent.
   */
  private filterChanges(): Observable<Required<TransactionFilters>> {
    const { from, to, direction, q } = this.filters.controls;
    const text$ = merge(
      q.valueChanges.pipe(debounceTime(SEARCH_DEBOUNCE_MS)),
      this.submits.pipe(map(() => q.value)),
    ).pipe(startWith(q.value));

    return combineLatest([
      from.valueChanges.pipe(startWith(from.value)),
      to.valueChanges.pipe(startWith(to.value)),
      direction.valueChanges.pipe(startWith(direction.value)),
      text$,
    ]).pipe(
      map(([f, t, d, text]) => cleanFilters({ from: f, to: t, direction: d, q: text })),
      distinctUntilChanged(sameFilters),
    );
  }

  private openAccount(id: number): void {
    this.accountId = id;
    this.account.set(null);
    this.page.set(null);
    this.error.set(null);
    this.api.get(id).subscribe({
      next: (a) => this.account.set(a),
      error: (err: unknown) => this.error.set(friendlyError(err, 'transactions')),
    });
  }

  private fetch(req: PageRequest): Observable<Page<TransactionView> | null> {
    const { from, to } = req.filters;
    if (from && to && from > to) {
      this.error.set('The "From" date must be on or before the "To" date.');
      return of(null);
    }
    this.loading.set(true);
    this.error.set(null);
    return this.api.transactions(req.accountId, req.filters, req.page, PAGE_SIZE).pipe(
      catchError((err: unknown) => {
        this.error.set(friendlyError(err, 'transactions'));
        return of(null);
      }),
    );
  }
}

function cleanFilters(f: TransactionFilters): Required<TransactionFilters> {
  return { from: f.from ?? '', to: f.to ?? '', direction: f.direction ?? '', q: (f.q ?? '').trim() };
}

function sameFilters(a: Required<TransactionFilters>, b: Required<TransactionFilters>): boolean {
  return a.from === b.from && a.to === b.to && a.direction === b.direction && a.q === b.q;
}
