/** An unsigned JWT with the given claims: enough for the portal, which only reads claims (the server verifies). */
export function fakeJwt(claims: Record<string, unknown>): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.signature`;
}

export function customerToken(overrides: Record<string, unknown> = {}): string {
  return fakeJwt({
    sub: '1',
    email: 'alex.morgan@example.com',
    roles: ['CUSTOMER'],
    cid: 1,
    exp: Math.floor(Date.now() / 1000) + 900,
    ...overrides,
  });
}

export function tokens(accessToken: string, refreshToken = 'refresh-1') {
  return { accessToken, tokenType: 'Bearer', expiresIn: 900, refreshToken };
}
