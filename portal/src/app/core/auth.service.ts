import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';

import { TokenResponse } from './api.models';

/** Who is signed in, read from the access token's claims. */
export interface SessionUser {
  userId: string;
  email: string;
  roles: string[];
  customerId: number | null;
  /** Expiry, in epoch milliseconds. */
  expiresAt: number;
}

/** Key for the refresh token in sessionStorage. */
export const REFRESH_TOKEN_KEY = 'cbp.refreshToken';

/** Treat a token as expired this long before it really is, so it never dies mid-request. */
const EXPIRY_SKEW_MS = 10_000;

/**
 * Login state.
 *
 * - The access token (15 min JWT) lives only in memory: page scripts can't find it in storage, and a reload
 *   just refreshes it.
 * - The refresh token is kept in sessionStorage so a reload stays signed in; it is cleared when the tab closes.
 *   (An httpOnly cookie would hide it from scripts entirely; that needs a backend change, noted in the README.)
 * - refresh() is single-flight: if five requests hit a 401 at once, only one refresh call goes out.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly token = signal<string | null>(null);
  private refreshInFlight: Observable<string> | null = null;

  readonly user = computed(() => {
    const token = this.token();
    return token ? decodeUser(token) : null;
  });

  readonly isLoggedIn = computed(() => this.user() !== null);

  accessToken(): string | null {
    return this.token();
  }

  hasRefreshToken(): boolean {
    return readRefreshToken() !== null;
  }

  login(email: string, password: string): Observable<SessionUser> {
    return this.http.post<TokenResponse>('/api/auth/login', { email, password }).pipe(
      tap((res) => this.store(res)),
      map(() => {
        const user = this.user();
        if (!user) {
          throw new Error('The server returned an unreadable token');
        }
        return user;
      }),
    );
  }

  /** New tokens from the stored refresh token. Emits the new access token. */
  refresh(): Observable<string> {
    const refreshToken = readRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('Not signed in'));
    }
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.http.post<TokenResponse>('/api/auth/refresh', { refreshToken }).pipe(
        tap((res) => this.store(res)),
        map((res) => res.accessToken),
        catchError((err: unknown) => {
          this.clear();
          return throwError(() => err);
        }),
        finalize(() => (this.refreshInFlight = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.refreshInFlight;
  }

  /** True if there is a usable session, refreshing first if the access token is missing or expired. */
  ensureSession(): Observable<boolean> {
    const user = this.user();
    if (user && !isExpired(user)) {
      return of(true);
    }
    if (!this.hasRefreshToken()) {
      return of(false);
    }
    return this.refresh().pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  logout(): void {
    const refreshToken = readRefreshToken();
    this.clear();
    if (refreshToken) {
      // Revoke it on the server too. Failures don't matter: the local session is already gone.
      this.http.post('/api/auth/logout', { refreshToken }).subscribe({ error: () => undefined });
    }
    this.router.navigate(['/login']).catch(() => undefined);
  }

  private store(res: TokenResponse): void {
    this.token.set(res.accessToken);
    writeRefreshToken(res.refreshToken);
  }

  private clear(): void {
    this.token.set(null);
    writeRefreshToken(null);
  }
}

export function isExpired(user: SessionUser, now = Date.now()): boolean {
  return user.expiresAt - EXPIRY_SKEW_MS <= now;
}

/** Reads the claims of a JWT. This does NOT verify it: the server does that on every request. */
export function decodeUser(token: string): SessionUser | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    const exp = claims['exp'];
    if (typeof exp !== 'number') {
      return null;
    }
    const roles = claims['roles'];
    const cid = claims['cid'];
    return {
      userId: String(claims['sub'] ?? ''),
      email: String(claims['email'] ?? ''),
      roles: Array.isArray(roles) ? roles.map(String) : [],
      customerId: typeof cid === 'number' ? cid : null,
      expiresAt: exp * 1000,
    };
  } catch {
    return null;
  }
}

function readRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeRefreshToken(value: string | null): void {
  try {
    if (value) {
      sessionStorage.setItem(REFRESH_TOKEN_KEY, value);
    } else {
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // Storage blocked (private mode, policy): the session just won't survive a reload.
  }
}
