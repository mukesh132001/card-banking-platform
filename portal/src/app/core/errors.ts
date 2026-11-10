import { HttpErrorResponse } from '@angular/common/http';

import { ProblemDetail } from './api.models';

/** What the user was doing, so the fallback message can say so. */
export type ErrorContext = 'login' | 'accounts' | 'transactions' | 'export' | 'admin';

const FALLBACK: Record<ErrorContext, string> = {
  login: 'Something went wrong. Please try again.',
  accounts: "We couldn't load your accounts. Please try again.",
  transactions: "We couldn't load your transactions. Please try again.",
  export: "We couldn't export your transactions. Please try again.",
  admin: "We couldn't load the back-office data. Please try again.",
};

/**
 * Turns an API error into a message a customer can act on.
 *
 * The API answers every error with an RFC 7807 problem detail ({ title, status, detail }). Its `detail` is written
 * for people (e.g. "Account 9 not found", the lockout time), so it is shown for 400/404/409/423. Anything else gets
 * a fixed message: a 500's text is never shown, and nothing technical (status codes, stack traces) reaches the page.
 */
export function friendlyError(err: unknown, context: ErrorContext): string {
  if (!(err instanceof HttpErrorResponse)) {
    return FALLBACK[context];
  }
  const detail = problemDetail(err);
  switch (err.status) {
    case 0:
      return "Can't reach the server. Check your connection, or that the account service is running.";
    case 400:
      return detail ?? 'Some of the details you entered are not valid. Please check them and try again.';
    case 401:
      return context === 'login'
        ? 'Invalid email or password. After 5 wrong tries in a row the login is locked for 15 minutes.'
        : 'Your session has ended. Please log in again.';
    case 403:
      return context === 'accounts'
        ? 'This login has no customer accounts (admin logins use the Back office page).'
        : "You don't have permission to do that.";
    case 404:
      return detail ?? "We couldn't find that. It may have been removed, or the link is wrong.";
    case 409:
      return detail ?? 'That conflicts with a recent change. Please refresh and try again.';
    case 423:
      return lockedMessage(detail);
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    default:
      return err.status >= 500 ? 'Something went wrong on our side. Please try again in a moment.' : FALLBACK[context];
  }
}

/**
 * The API says "Too many failed login attempts. Try again after 2026-11-10T20:45:12Z." Show that time the way
 * people read it ("after 3:45 pm") in their own time zone.
 */
function lockedMessage(detail: string | null): string {
  const iso = detail?.match(/\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})/)?.[0];
  const until = iso ? new Date(iso) : null;
  if (until && !Number.isNaN(until.getTime())) {
    const time = until.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `Too many failed login attempts, so this login is locked. Try again after ${time}, or ask the bank to unlock it.`;
  }
  return detail ?? 'Too many failed login attempts, so this login is locked for 15 minutes.';
}

function problemDetail(err: HttpErrorResponse): string | null {
  const body = err.error as ProblemDetail | string | null;
  if (body && typeof body === 'object' && typeof body.detail === 'string' && body.detail.trim() !== '') {
    return body.detail;
  }
  return null;
}
