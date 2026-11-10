import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ACCOUNT_TYPE_LABELS, AccountSummary, Direction, Page, ProblemDetail, TransactionFilters, TransactionView } from '../core/api.models';
import { AccountsService } from '../core/accounts.service';
import { downloadCsv, transactionsToCsv } from '../core/csv';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-transactions',
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe, RouterLink],
  template: `
    <p><a routerLink="/accounts">← All accounts</a></p>
    @if (account(); as a) {
      <h1>{{ typeLabel(a) }} {{ a.maskedNumber }}</h1>
      <p class="total">Balance <strong>{{ a.balance | currency: a.currency }}</strong></p>
    } @else {
      <h1>Transactions</h1>
    }

    <form class="filters" [formGroup]="filters" (ngSubmit)="apply()" aria-label="Filter transactions">
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
        <input id="q" type="search" formControlName="q" placeholder="Merchant or description" maxlength="100" />
      </div>
      <div class="actions">
        <button type="submit" class="primary">Apply</button>
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
    </div>

    @if (page(); as p) {
      @if (p.totalElements === 0) {
        <p class="muted">No transactions match these filters.</p>
      } @else {
        <table class="transactions">
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
                <td class="num" [class.credit]="t.direction === 'CREDIT'">{{ t.signedAmount | currency: currency() }}</td>
                <td class="num">{{ t.balanceAfter | currency: currency() }}</td>
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

  private accountId = 0;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.accountId = Number(params.get('id'));
      this.account.set(null);
      this.page.set(null);
      this.api.get(this.accountId).subscribe({
        next: (a) => this.account.set(a),
        error: (err: unknown) => this.error.set(errorMessage(err)),
      });
      this.load(0);
    });
  }

  currency(): string {
    return this.account()?.currency ?? 'GBP';
  }

  typeLabel(a: AccountSummary): string {
    return ACCOUNT_TYPE_LABELS[a.type] ?? a.type;
  }

  apply(): void {
    this.load(0);
  }

  clear(): void {
    this.filters.reset();
    this.load(0);
  }

  goTo(page: number): void {
    this.load(page);
  }

  exportCsv(): void {
    this.exporting.set(true);
    this.api.allTransactions(this.accountId, this.currentFilters()).subscribe({
      next: (rows) => {
        downloadCsv(`transactions-${this.account()?.maskedNumber.slice(-4) ?? this.accountId}.csv`, transactionsToCsv(rows));
        this.exporting.set(false);
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.exporting.set(false);
      },
    });
  }

  private currentFilters(): TransactionFilters {
    return this.filters.getRawValue();
  }

  private load(page: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.transactions(this.accountId, this.currentFilters(), page, PAGE_SIZE).subscribe({
      next: (p) => {
        this.page.set(p);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}

/** The server's problem-detail message for 400/404, or a friendly fallback. */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const detail = (err.error as ProblemDetail | null)?.detail;
    if ((err.status === 400 || err.status === 404) && detail) {
      return detail;
    }
    if (err.status === 0) {
      return "Can't reach the server.";
    }
  }
  return 'Something went wrong loading transactions. Please try again.';
}
