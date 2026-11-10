# Notes to know: M2 portal

Short explanations of the ideas in the portal, written so you can say them out loud in an interview.

## 1. Where the token lives
- **Access token (15 min) is in memory** (an Angular signal). `localStorage` is readable by every script on the page,
  so a single XSS bug or a bad npm package could steal the token. Memory is gone when the tab closes.
- **Refresh token is in `sessionStorage`** so a reload stays signed in. It is single use and rotated on every refresh;
  replaying an old one makes the API revoke all of that user's tokens. Next step: an httpOnly cookie.
- "Why not just localStorage?" → *"Because the token is a bearer credential: whoever holds it is you. I keep it where
  injected scripts can't find it, and keep its lifetime short."*

## 2. The interceptor
- One function sees every HTTP request. It adds `Authorization: Bearer …` only to our own `/api` (never to other sites,
  never to `/api/auth/*`).
- **Refresh before send** if the token already expired; **refresh and retry once** on a 401; **log out** if the refresh fails.
- **Single-flight refresh:** if 5 requests fail at once, `shareReplay` makes them all wait for the same refresh call.
  Without it, 5 refreshes race, and because refresh tokens are single use, 4 of them fail and log the user out.

## 3. Route guards
- `roleGuard('CUSTOMER')` / `roleGuard('ADMIN')` decide which pages a user can open; the wrong role is sent to its own home.
- **Guards are UX, not security.** The browser can be edited; the API checks the role on every request. Say this.
- `safeReturnUrl` blocks open redirects (`/login?returnUrl=https://evil.example`).

## 4. Money as strings
- `0.1 + 0.2 === 0.30000000000000004` in JavaScript, and a 16+ digit amount loses its last digit as a float.
- The API sends `"5309.01"` (Jackson `@JsonFormat(shape = STRING)` on the `BigDecimal` fields). The portal adds amounts as
  **BigInt pence** and formats them digit for digit. Banks never let money touch a float.

## 5. Debounced search (RxJS)
- `debounceTime(300)`: wait until typing stops for 300 ms → "tesco" is 1 request, not 5.
- `distinctUntilChanged`: "tesco" and "tesco " don't search twice.
- `switchMap`: a new search cancels the old request, so a slow answer for "tes" can't overwrite "tesco" (a race condition).
- Paging is on the server (`page`, `size`), so the browser never downloads 10,000 rows.

## 6. Error handling
- The API returns RFC 7807 problem details: `{ title, status, detail }`. `friendlyError()` maps them in one place:
  the API's words for 400/404/409/423, fixed text for 0/401/403/429/5xx. Never show a 500's text (it can leak internals).

## 7. Performance
- **Lazy routes:** each page's code downloads only when first opened, so the first load is smaller.
- **`OnPush`:** Angular re-checks a component only when its inputs, events or signals change, instead of after every
  event anywhere in the app. With signals this is free.
- **Lighthouse:** measure before and after on the production build; quote the real numbers, not guesses.

## 8. Tests
- Unit tests fake the HTTP layer (`HttpTestingController`) and time (`fakeAsync` + `tick` for the debounce).
- Cypress drives a real browser against the real API: login → accounts → transactions → search.
- CI (`portal` job) runs unit tests, the production build and the Cypress test on every push and PR.
