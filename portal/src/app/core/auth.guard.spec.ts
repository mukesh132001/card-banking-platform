import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';

import { authGuard, guestGuard, roleGuard, safeReturnUrl } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  function run(url: string, guard: CanActivateFn = authGuard): boolean | UrlTree | undefined {
    let result: boolean | UrlTree | undefined;
    const outcome = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as Observable<boolean | UrlTree>;
    outcome.subscribe((r) => (result = r));
    return result;
  }

  it('lets a signed-in user through', () => {
    spyOn(auth, 'ensureSession').and.returnValue(of(true));
    expect(run('/accounts')).toBeTrue();
  });

  it('sends everyone else to /login and remembers where they were going', () => {
    spyOn(auth, 'ensureSession').and.returnValue(of(false));
    const result = run('/accounts/1');
    expect(result instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Faccounts%2F1');
  });
});

describe('roleGuard', () => {
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  function run(guard: CanActivateFn, url: string): string | true {
    let result: boolean | UrlTree | undefined;
    const outcome = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as Observable<boolean | UrlTree>;
    outcome.subscribe((r) => (result = r));
    return result instanceof UrlTree ? router.serializeUrl(result) : (result as true);
  }

  function signedInAs(...roles: ('CUSTOMER' | 'ADMIN')[]): void {
    spyOn(auth, 'ensureSession').and.returnValue(of(true));
    spyOn(auth, 'hasRole').and.callFake((r) => roles.includes(r));
    spyOn(auth, 'homeUrl').and.returnValue(roles.includes('CUSTOMER') ? '/accounts' : '/admin');
  }

  it('lets a customer into customer pages', () => {
    signedInAs('CUSTOMER');
    expect(run(roleGuard('CUSTOMER'), '/accounts')).toBeTrue();
  });

  it('sends a customer who opens /admin back to their accounts', () => {
    signedInAs('CUSTOMER');
    expect(run(roleGuard('ADMIN'), '/admin')).toBe('/accounts');
  });

  it('lets an admin into the back office, and sends them there from customer pages', () => {
    signedInAs('ADMIN');
    expect(run(roleGuard('ADMIN'), '/admin')).toBeTrue();
    expect(run(roleGuard('CUSTOMER'), '/accounts/1')).toBe('/admin');
  });

  it('sends signed-out users to /login, remembering the page', () => {
    spyOn(auth, 'ensureSession').and.returnValue(of(false));
    expect(run(roleGuard('ADMIN'), '/admin')).toBe('/login?returnUrl=%2Fadmin');
  });

  it('keeps signed-in users off the login page', () => {
    signedInAs('CUSTOMER');
    expect(run(guestGuard, '/login')).toBe('/accounts');
  });
});

describe('safeReturnUrl', () => {
  it('keeps same-site paths', () => {
    expect(safeReturnUrl('/accounts/1?page=2')).toBe('/accounts/1?page=2');
  });

  it('refuses anything that could leave the site', () => {
    for (const evil of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '', null]) {
      expect(safeReturnUrl(evil)).withContext(String(evil)).toBe('/accounts');
    }
  });
});
