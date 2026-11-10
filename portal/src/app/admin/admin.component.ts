import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { AdminCustomer, AdminUser } from '../core/api.models';
import { AdminService } from '../core/admin.service';
import { friendlyError } from '../core/errors';

/** Back office (ADMIN only): logins with their lockout state, and customers. */
@Component({
  selector: 'app-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Back office</h1>

    <div aria-live="polite">
      @if (error(); as message) {
        <p class="alert" role="alert">{{ message }}</p>
      }
      @if (notice(); as message) {
        <p class="notice">{{ message }}</p>
      }
    </div>

    @if (users(); as list) {
      <section aria-labelledby="logins-heading">
        <h2 id="logins-heading">Logins</h2>
        <p class="muted">{{ lockedCount() }} locked · a login locks after 5 wrong passwords in a row, for 15 minutes.</p>
        <table class="transactions">
          <thead>
            <tr>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col" class="num">Failed tries</th>
              <th scope="col">Status</th>
              <th scope="col"><span class="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (u of list; track u.id) {
              <tr>
                <td>{{ u.email }}</td>
                <td>{{ u.role }}</td>
                <td class="num">{{ u.failedAttempts }}</td>
                <td>
                  @if (u.locked) {
                    <span class="status">Locked</span>
                  } @else {
                    Active
                  }
                </td>
                <td>
                  @if (u.locked) {
                    <button type="button" (click)="unlock(u)" [disabled]="unlocking() === u.id"
                            [attr.aria-label]="'Unlock ' + u.email">
                      {{ unlocking() === u.id ? 'Unlocking…' : 'Unlock' }}
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    }

    @if (customers(); as list) {
      <section aria-labelledby="customers-heading">
        <h2 id="customers-heading">Customers</h2>
        <table class="transactions">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col" class="num">Accounts</th>
            </tr>
          </thead>
          <tbody>
            @for (c of list; track c.id) {
              <tr>
                <td>{{ c.fullName }}</td>
                <td>{{ c.email }}</td>
                <td class="num">{{ c.accounts }}</td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    }

    @if (!users() && !error()) {
      <p class="muted">Loading…</p>
    }
  `,
})
export class AdminComponent {
  private readonly api = inject(AdminService);

  readonly users = signal<AdminUser[] | null>(null);
  readonly customers = signal<AdminCustomer[] | null>(null);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly unlocking = signal<number | null>(null);
  readonly lockedCount = computed(() => (this.users() ?? []).filter((u) => u.locked).length);

  constructor() {
    forkJoin({ users: this.api.users(), customers: this.api.customers() })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: ({ users, customers }) => {
          this.users.set(users);
          this.customers.set(customers);
        },
        error: (err: unknown) => this.error.set(friendlyError(err, 'admin')),
      });
  }

  unlock(user: AdminUser): void {
    this.unlocking.set(user.id);
    this.error.set(null);
    this.notice.set(null);
    this.api.unlock(user.id).subscribe({
      next: () => {
        this.users.update((list) =>
          (list ?? []).map((u) => (u.id === user.id ? { ...u, locked: false, failedAttempts: 0 } : u)),
        );
        this.notice.set(`${user.email} is unlocked and can log in again.`);
        this.unlocking.set(null);
      },
      error: (err: unknown) => {
        this.error.set(friendlyError(err, 'admin'));
        this.unlocking.set(null);
      },
    });
  }
}
