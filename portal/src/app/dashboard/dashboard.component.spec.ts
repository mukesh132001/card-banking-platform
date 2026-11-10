import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AccountSummary } from '../core/api.models';
import { AccountsService } from '../core/accounts.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  const accounts: AccountSummary[] = [
    { id: 1, maskedNumber: '•••• 1234', type: 'CHECKING', currency: 'GBP', balance: 5309.01, status: 'ACTIVE', openedAt: '2026-08-01T09:00:00Z' },
    { id: 2, maskedNumber: '•••• 9876', type: 'SAVINGS', currency: 'GBP', balance: 13084, status: 'ACTIVE', openedAt: '2026-08-01T09:00:00Z' },
  ];

  function render(list: AccountsService['list']): HTMLElement {
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideRouter([]), { provide: AccountsService, useValue: { list } }],
    });
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows each account with its balance, and the total', () => {
    const el = render(() => of(accounts));
    const cards = el.querySelectorAll('li.account');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Current account');
    expect(cards[0].textContent).toContain('•••• 1234');
    expect(cards[0].textContent).toContain('£5,309.01');
    expect(el.querySelector('.total')?.textContent).toContain('£18,393.01');
    expect(cards[1].querySelector('a')?.getAttribute('href')).toBe('/accounts/2');
  });

  it('explains when an admin login has no customer accounts', () => {
    const el = render(() => throwError(() => new HttpErrorResponse({ status: 403 })));
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('no customer accounts');
  });
});
