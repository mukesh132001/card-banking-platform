import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

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
 * Only same-site paths are allowed after login, so a link like /login?returnUrl=https://evil.example
 * can't bounce a user to another site (an "open redirect").
 */
export function safeReturnUrl(value: string | null | undefined, fallback = '/accounts'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  return value;
}
