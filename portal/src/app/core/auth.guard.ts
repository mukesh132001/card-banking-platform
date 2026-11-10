import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { Role } from './api.models';
import { AuthService } from './auth.service';

/** Lets signed-in users through; sends everyone else to /login and remembers where they were going. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth
    .ensureSession()
    .pipe(map((ok) => (ok ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }))));
};

/**
 * Only users with `role` get in. Signed-out users go to /login (like authGuard); signed-in users with the wrong
 * role go to their own home page (a customer opening /admin lands on /accounts) instead of a blank, failing page.
 *
 * This is for UX only: the API checks the role on every request, so hiding a page is never the security boundary.
 */
export function roleGuard(role: Role): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.ensureSession().pipe(
      map((ok) => {
        if (!ok) {
          return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
        }
        return auth.hasRole(role) ? true : router.parseUrl(auth.homeUrl());
      }),
    );
  };
}

/** Sends users who are already signed in away from /login, to their home page. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureSession().pipe(map((ok) => (ok ? router.parseUrl(auth.homeUrl()) : true)));
};

/**
 * Only same-site paths are allowed after login, so a link like /login?returnUrl=https://evil.example
 * can't bounce a user to another site (an "open redirect").
 */
export function safeReturnUrl(value: string | null | undefined, fallback = '/accounts'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  return value;
}
