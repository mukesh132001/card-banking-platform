import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { customerToken, fakeJwt, tokens } from '../testing/fake-jwt';
import { AuthService, REFRESH_TOKEN_KEY, decodeUser, isExpired } from './auth.service';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([{ path: 'login', children: [] }])],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  function logIn(): void {
    auth.login('alex.morgan@example.com', 'pw').subscribe();
    http.expectOne('/api/auth/login').flush(tokens(customerToken()));
  }

  it('logs in, keeps the access token in memory and the refresh token in sessionStorage', () => {
    let email = '';
    auth.login('alex.morgan@example.com', 'alex-demo-password').subscribe((u) => (email = u.email));

    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'alex.morgan@example.com', password: 'alex-demo-password' });
    req.flush(tokens(customerToken()));

    expect(email).toBe('alex.morgan@example.com');
    expect(auth.isLoggedIn()).toBeTrue();
    expect(auth.user()?.customerId).toBe(1);
    expect(sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-1');
    const stored = Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.getItem(sessionStorage.key(i)!));
    expect(stored).not.toContain(auth.accessToken());
  });

  it('sends only one refresh request when several callers need a new token at once', () => {
    logIn();
    const results: string[] = [];
    auth.refresh().subscribe((t) => results.push(t));
    auth.refresh().subscribe((t) => results.push(t));
    auth.refresh().subscribe((t) => results.push(t));

    const fresh = customerToken({ sub: '1', exp: Math.floor(Date.now() / 1000) + 1800 });
    const req = http.expectOne('/api/auth/refresh');
    expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
    req.flush(tokens(fresh, 'refresh-2'));

    expect(results).toEqual([fresh, fresh, fresh]);
    expect(sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-2');
  });

  it('clears the session when the refresh token is rejected', () => {
    logIn();
    auth.refresh().subscribe({ error: () => undefined });
    http.expectOne('/api/auth/refresh').flush({ title: 'Invalid refresh token' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isLoggedIn()).toBeFalse();
    expect(sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('restores a session after a page reload using the stored refresh token', () => {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-from-last-time');
    let ok: boolean | undefined;
    auth.ensureSession().subscribe((v) => (ok = v));
    http.expectOne('/api/auth/refresh').flush(tokens(customerToken()));
    expect(ok).toBeTrue();
  });

  it('reports no session when there is nothing to refresh', () => {
    let ok: boolean | undefined;
    auth.ensureSession().subscribe((v) => (ok = v));
    expect(ok).toBeFalse();
  });

  it('logout clears the session and revokes the refresh token on the server', () => {
    logIn();
    auth.logout();
    expect(auth.isLoggedIn()).toBeFalse();
    const req = http.expectOne('/api/auth/logout');
    expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('knows the roles and where each kind of user lands', () => {
    logIn();
    expect(auth.hasRole('CUSTOMER')).toBeTrue();
    expect(auth.hasRole('ADMIN')).toBeFalse();
    expect(auth.homeUrl()).toBe('/accounts');

    auth.login('admin@example.com', 'pw').subscribe();
    http
      .expectOne('/api/auth/login')
      .flush(tokens(fakeJwt({ sub: '9', email: 'admin@example.com', roles: ['ADMIN'], exp: Math.floor(Date.now() / 1000) + 900 })));
    expect(auth.hasRole('ADMIN')).toBeTrue();
    expect(auth.homeUrl()).toBe('/admin');
  });

  it('needs a refresh only when the access token has expired and a refresh token is stored', () => {
    expect(auth.needsRefresh()).toBeFalse();
    logIn();
    expect(auth.needsRefresh()).toBeFalse();
    expect(auth.needsRefresh(Date.now() + 15 * 60_000)).toBeTrue();
  });

  it('reads claims from a token and spots expiry', () => {
    const user = decodeUser(fakeJwt({ sub: '7', email: 'a@b.c', roles: ['ADMIN'], exp: 1 }));
    expect(user).toEqual({ userId: '7', email: 'a@b.c', roles: ['ADMIN'], customerId: null, expiresAt: 1000 });
    expect(isExpired(user!)).toBeTrue();
    expect(decodeUser('not-a-jwt')).toBeNull();
  });
});
