import { HttpErrorResponse } from '@angular/common/http';

import { friendlyError } from './errors';

describe('friendlyError', () => {
  const problem = (status: number, detail?: string) =>
    new HttpErrorResponse({ status, error: detail ? { title: 'x', status, detail } : null });

  it('explains a network failure', () => {
    expect(friendlyError(problem(0), 'accounts')).toContain("Can't reach the server");
  });

  it("uses the API's own words for 400, 404 and 409", () => {
    expect(friendlyError(problem(400, 'size must be between 1 and 100'), 'transactions')).toBe('size must be between 1 and 100');
    expect(friendlyError(problem(404, 'Account 9 not found'), 'transactions')).toBe('Account 9 not found');
    expect(friendlyError(problem(409, 'That conflicts with existing data. Please retry.'), 'admin')).toContain('conflicts');
    expect(friendlyError(problem(404), 'transactions')).toContain("couldn't find");
  });

  it('separates a wrong password from an expired session', () => {
    expect(friendlyError(problem(401), 'login')).toContain('Invalid email or password');
    expect(friendlyError(problem(401), 'login')).toContain('5 wrong tries');
    expect(friendlyError(problem(401), 'accounts')).toContain('session has ended');
  });

  it('turns the lockout time into a readable local time', () => {
    const msg = friendlyError(problem(423, 'Too many failed login attempts. Try again after 2026-11-10T20:45:00Z.'), 'login');
    expect(msg).toContain('locked');
    expect(msg).not.toContain('2026-11-10T');
    expect(friendlyError(problem(423), 'login')).toContain('locked for 15 minutes');
  });

  it('never shows server internals for a 5xx', () => {
    const msg = friendlyError(problem(500, 'NullPointerException at com.mukii...'), 'accounts');
    expect(msg).toBe('Something went wrong on our side. Please try again in a moment.');
  });

  it('explains 403 and 429', () => {
    expect(friendlyError(problem(403), 'accounts')).toContain('no customer accounts');
    expect(friendlyError(problem(403), 'admin')).toContain("don't have permission");
    expect(friendlyError(problem(429), 'login')).toContain('Too many requests');
  });

  it('falls back to a message for what the user was doing', () => {
    expect(friendlyError(new Error('boom'), 'export')).toContain("couldn't export");
  });
});
