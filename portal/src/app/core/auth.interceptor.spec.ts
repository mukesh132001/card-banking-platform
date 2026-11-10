import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'login', children: [] }]),
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => http.verify());

  it('adds the bearer token to API calls', () => {
    spyOn(auth, 'accessToken').and.returnValue('abc');
    client.get('/api/accounts').subscribe();
    expect(http.expectOne('/api/accounts').request.headers.get('Authorization')).toBe('Bearer abc');
  });

  it('never sends the access token to the auth endpoints or other sites', () => {
    spyOn(auth, 'accessToken').and.returnValue('abc');
    client.post('/api/auth/login', {}).subscribe();
    client.get('https://cdn.example.com/file.json').subscribe();
    expect(http.expectOne('/api/auth/login').request.headers.has('Authorization')).toBeFalse();
    expect(http.expectOne('https://cdn.example.com/file.json').request.headers.has('Authorization')).toBeFalse();
  });

  it('on a 401, refreshes once and retries with the new token', () => {
    spyOn(auth, 'accessToken').and.returnValue('expired');
    spyOn(auth, 'hasRefreshToken').and.returnValue(true);
    const refresh = spyOn(auth, 'refresh').and.returnValue(of('fresh'));
    let body: unknown;
    client.get('/api/accounts').subscribe((b) => (body = b));

    http.expectOne('/api/accounts').flush(null, { status: 401, statusText: 'Unauthorized' });
    const retry = http.expectOne('/api/accounts');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer fresh');
    retry.flush([{ id: 1 }]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(body).toEqual([{ id: 1 }]);
  });

  it('logs out when the refresh fails too', () => {
    spyOn(auth, 'accessToken').and.returnValue('expired');
    spyOn(auth, 'hasRefreshToken').and.returnValue(true);
    spyOn(auth, 'refresh').and.returnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const logout = spyOn(auth, 'logout');
    let failed = false;
    client.get('/api/accounts').subscribe({ error: () => (failed = true) });

    http.expectOne('/api/accounts').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(logout).toHaveBeenCalled();
    expect(failed).toBeTrue();
  });

  it('passes other errors straight through without refreshing', () => {
    const refresh = spyOn(auth, 'refresh');
    let status = 0;
    client.get('/api/accounts/9').subscribe({ error: (e: HttpErrorResponse) => (status = e.status) });
    http.expectOne('/api/accounts/9').flush({ title: 'Account not found' }, { status: 404, statusText: 'Not Found' });
    expect(status).toBe(404);
    expect(refresh).not.toHaveBeenCalled();
  });
});
