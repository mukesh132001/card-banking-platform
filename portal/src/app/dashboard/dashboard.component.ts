import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { ACCOUNT_TYPE_LABELS, AccountSummary } from '../core/api.models';
import { AccountsService } from '../core/accounts.service';
import { friendlyError } from '../core/errors';
import { sumMoney } from '../core/money';
import { MoneyPipe } from '../core/money.pipe';

@Component({
  selector: 'app-dashboard',
  imports: [MoneyPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Your accounts</h1>
    @if (error(); as message) {
      <p class="alert" role="alert">{{ message }}</p>
    } @else {
      @if (accounts(); as list) {
        @if (list.length === 0) {
          <p class="muted">You don't have any accounts yet.</p>
        } @else {
          @if (total(); as t) {
            <p class="total">Total balance <strong>{{ t.amount | money: t.currency }}</strong></p>
          }
          <ul class="account-list">
            @for (a of list; track a.id) {
              <li class="card account">
                <a [routerLink]="['/accounts', a.id]" [attr.aria-label]="typeLabel(a) + ' ending ' + a.maskedNumber.slice(-4)">
                  <span class="type">{{ typeLabel(a) }}</span>
                  <span class="number">{{ a.maskedNumber }}</span>
                  <span class="balance">{{ a.balance | money: a.currency }}</span>
                  @if (a.status !== 'ACTIVE') {
                    <span class="status">{{ a.status }}</span>
                  }
                </a>
              </li>
            }
          </ul>
        }
      } @else {
        <p class="muted" aria-live="polite">Loading your accounts…</p>
      }
    }
  `,
})
export class DashboardComponent {
  private readonly api = inject(AccountsService);

  readonly accounts = signal<AccountSummary[] | null>(null);
  readonly error = signal<string | null>(null);

  /** Exact sum of balances (BigInt pence, no float drift), shown only when every account is in the same currency. */
  readonly total = computed(() => {
    const list = this.accounts() ?? [];
    const currencies = new Set(list.map((a) => a.currency));
    if (list.length === 0 || currencies.size !== 1) {
      return null;
    }
    return { amount: sumMoney(list.map((a) => a.balance)), currency: list[0].currency };
  });

  constructor() {
    this.api
      .list()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (list) => this.accounts.set(list),
        error: (err: unknown) => this.error.set(friendlyError(err, 'accounts')),
      });
  }

  typeLabel(a: AccountSummary): string {
    return ACCOUNT_TYPE_LABELS[a.type] ?? a.type;
  }
}
