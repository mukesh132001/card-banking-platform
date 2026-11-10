import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService, SessionUser } from '../core/auth.service';
import { LoginComponent, loginErrorMessage } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let auth: jasmine.SpyObj<AuthService>;
  let router: Router;
  let returnUrl: string | null;

  const user: SessionUser = { userId: '1', email: 'alex.morgan@example.com', roles: ['CUSTOMER'], customerId: 1, expiresAt: Date.now() + 900_000 };

  beforeEach(() => {
    returnUrl = null;
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['login']);
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useFactory: () => ({ snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) } }) },
      ],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
  });

  function render(): HTMLElement {
    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function fill(el: HTMLElement, email: string, password: string): void {
    const set = (selector: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    set('#email', email);
    set('#password', password);
  }

  function submit(el: HTMLElement): void {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('does not call the server when the form is invalid, and shows what is wrong', () => {
    const el = render();
    fill(el, 'not-an-email', '');
    submit(el);
    expect(auth.login).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Enter a valid email address.');
    expect(el.textContent).toContain('Enter your password.');
  });

  it('logs in and goes to the accounts page', () => {
    auth.login.and.returnValue(of(user));
    const el = render();
    fill(el, 'alex.morgan@example.com', 'alex-demo-password');
    submit(el);
    expect(auth.login).toHaveBeenCalledWith('alex.morgan@example.com', 'alex-demo-password');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/accounts');
  });

  it('returns to the page the user was trying to open', () => {
    returnUrl = '/accounts/1';
    auth.login.and.returnValue(of(user));
    const el = render();
    fill(el, 'alex.morgan@example.com', 'alex-demo-password');
    submit(el);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/accounts/1');
  });

  it('ignores a returnUrl that points to another site', () => {
    returnUrl = '//evil.example/phish';
    auth.login.and.returnValue(of(user));
    const el = render();
    fill(el, 'alex.morgan@example.com', 'alex-demo-password');
    submit(el);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/accounts');
  });

  it('shows a clear message for a wrong password and clears the field', () => {
    auth.login.and.returnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const el = render();
    fill(el, 'alex.morgan@example.com', 'wrong-password');
    submit(el);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Invalid email or password.');
    expect(el.querySelector<HTMLInputElement>('#password')!.value).toBe('');
  });

  it('explains a locked account using the server message', () => {
    const locked = new HttpErrorResponse({ status: 423, error: { detail: 'Too many failed login attempts. Try again after 10:15.' } });
    expect(loginErrorMessage(locked)).toBe('Too many failed login attempts. Try again after 10:15.');
    expect(loginErrorMessage(new HttpErrorResponse({ status: 0 }))).toContain("Can't reach the server");
  });
});
