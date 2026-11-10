import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth.service';

/** Endpoints that must never carry (or retry with) an access token. */
const AUTH_ENDPOINTS = ['/api/auth/login', '/api/auth/signup', '/api/auth/refresh', '/api/auth/logout'];

/**
 * Adds "Authorization: Bearer <token>" to API calls (and only to our own /api, never to other sites).
 *
 * - Token already expired? Refresh first, then send: no wasted 401.
 * - Got a 401 anyway (clock skew, token revoked)? Refresh once and retry.
 * - Refresh failed too? Log out.
 *
 * AuthService.refresh() is single-flight, so ten parallel requests with an expired token cause one refresh call.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/') || AUTH_ENDPOINTS.some((path) => req.url.startsWith(path))) {
    return next(req);
  }
  const auth = inject(AuthService);

  if (auth.needsRefresh()) {
    return refreshThen(auth, req, next);
  }

  return next(withToken(req, auth.accessToken())).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || !auth.hasRefreshToken()) {
        return throwError(() => err);
      }
      return refreshThen(auth, req, next);
    }),
  );
};

function withToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

/** Refresh, then send the request with the new token. If the refresh fails, log out and fail the request. */
function refreshThen(auth: AuthService, req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> {
  return auth.refresh().pipe(
    catchError((refreshErr: unknown) => {
      auth.logout();
      return throwError(() => refreshErr);
    }),
    switchMap((token) => next(withToken(req, token))),
  );
}
