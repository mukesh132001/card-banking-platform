import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AdminCustomer, AdminUser } from '../core/api.models';
import { AdminService } from '../core/admin.service';
import { AdminComponent } from './admin.component';

describe('AdminComponent', () => {
  const users: AdminUser[] = [
    { id: 1, email: 'alex.morgan@example.com', role: 'CUSTOMER', customerId: 1, failedAttempts: 5, locked: true },
    { id: 3, email: 'admin@example.com', role: 'ADMIN', customerId: null, failedAttempts: 0, locked: false },
  ];
  const customers: AdminCustomer[] = [{ id: 1, email: 'alex.morgan@example.com', fullName: 'Alex Morgan', accounts: 2 }];

  let api: jasmine.SpyObj<AdminService>;
  let fixture: ComponentFixture<AdminComponent>;
  let el: HTMLElement;

  beforeEach(() => {
    api = jasmine.createSpyObj<AdminService>('AdminService', ['users', 'customers', 'unlock']);
    api.users.and.returnValue(of(users));
    api.customers.and.returnValue(of(customers));
    TestBed.configureTestingModule({ imports: [AdminComponent], providers: [{ provide: AdminService, useValue: api }] });
  });

  function render(): void {
    fixture = TestBed.createComponent(AdminComponent);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  it('lists logins with their lock status, and customers', () => {
    render();
    const rows = el.querySelectorAll('section:first-of-type tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Locked');
    expect(rows[1].querySelector('button')).toBeNull();
    expect(el.textContent).toContain('1 locked');
    expect(el.textContent).toContain('Alex Morgan');
  });

  it('unlocks a login', () => {
    api.unlock.and.returnValue(of(undefined));
    render();
    el.querySelector<HTMLButtonElement>('button[aria-label="Unlock alex.morgan@example.com"]')!.click();
    fixture.detectChanges();

    expect(api.unlock).toHaveBeenCalledWith(1);
    expect(el.textContent).toContain('0 locked');
    expect(el.querySelector('.notice')?.textContent).toContain('alex.morgan@example.com is unlocked');
  });

  it('shows a friendly message when the API refuses', () => {
    api.users.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    render();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("don't have permission");
  });
});
