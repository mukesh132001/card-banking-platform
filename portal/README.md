# Customer portal (Angular)

Angular 19 single-page app for the card banking platform: log in, see accounts and balances, browse, search and
export transactions, and (for admins) a back office to unlock logins. It talks to
[account-service](../services/account-service) through `/api`.

```powershell
# 1. Start the API (another terminal):  cd ..\services\account-service ; .\mvnw.cmd spring-boot:run
# 2. Then:
npm install
npm start          # http://localhost:4200  (proxies /api to localhost:8080, so no CORS setup is needed)
npm test           # unit tests in Chrome, re-runs on save
npm run test:ci    # once, headless, with coverage (what CI runs)
npm run e2e        # Cypress end-to-end: starts the portal, needs the API running
npm run build      # production build in dist/portal
```

Demo logins: `alex.morgan@example.com` / `alex-demo-password`, `priya.shah@example.com` / `priya-demo-password`
(customers), `admin@example.com` / `admin-demo-password` (back office).

## How it's built

| Piece | File | What it does |
| --- | --- | --- |
| Auth state | `core/auth.service.ts` | Login, refresh, logout, roles. Access token in memory only (a signal, never in storage); refresh token in `sessionStorage`. `refresh()` is single-flight, so many 401s at once cause one refresh call |
| Interceptor | `core/auth.interceptor.ts` | Adds `Authorization: Bearer …` to `/api` calls only (never to the auth endpoints or other sites). Token already expired: refresh first, then send. A 401 anyway: refresh once and retry. Refresh fails: log out |
| Route guards | `core/auth.guard.ts` | `roleGuard('CUSTOMER')` on `/accounts/**`, `roleGuard('ADMIN')` on `/admin`; signed-out users go to `/login?returnUrl=…`, the wrong role goes to its own home page. Only same-site return URLs are honoured (no open redirect). `guestGuard` keeps signed-in users off `/login` |
| Login | `login/` | Reactive form with validation; clear messages for a wrong password, the 5-try lockout (with the unlock time in local time) and the server being down |
| Accounts | `dashboard/` | Cards per account with masked number and balance, plus an exact total |
| Transactions | `transactions/` | Paging on the server; date range and money in/out apply at once; search waits until you stop typing (`debounceTime(300)`), and `switchMap` cancels stale requests. CSV export of every matching row |
| Back office | `admin/` | Logins with failed attempts and lock status, with an Unlock button; customers with their account counts |
| Money | `core/money.ts`, `core/money.pipe.ts` | The API sends money as exact decimal strings (`"5309.01"`). Totals are added as BigInt pence and formatted digit for digit, so `0.10 + 0.20` is `0.30`, not `0.30000000000000004` |
| Errors | `core/errors.ts` | One place that turns RFC 7807 problem details into friendly messages: the API's own words for 400/404/409/423, fixed text for 0/401/403/429/5xx, never server internals |
| CSV | `core/csv.ts` | RFC 4180 quoting, UTF-8 BOM for Excel, exact money cells, and formula neutralising so a merchant name like `=HYPERLINK(…)` can't run in a spreadsheet (CSV injection) |

Standalone components, signals, `OnPush` change detection everywhere, the `@if` / `@for` control flow, every route
lazy-loaded, functional guards and interceptors, strict TypeScript and strict templates.

**Why the access token is in memory, not `localStorage`:** anything in `localStorage` can be read by any script on
the page, so one XSS bug (or a compromised npm package) could copy the token and use it from anywhere. A variable in
memory disappears with the tab, and a reload just gets a new token from the refresh token. The refresh token is in
`sessionStorage` for now (cleared when the tab closes, single use, rotated each time); the next step is an
httpOnly, SameSite cookie set by the API, which scripts can't read at all.

**Accessibility:** a skip link, labelled inputs, `aria-invalid` with linked error text, `aria-live` regions for
errors and loading, tables with column headers, `aria-current` on the active nav link, visible focus outlines,
and colour contrast within WCAG AA.

## Tests

- **Unit** (Jasmine + Karma): auth service (token storage, single-flight refresh, reload restore, roles, logout),
  interceptor (header rules, refresh before send, refresh-and-retry, logout on failed refresh), guards (roles,
  return-URL safety, login page), accounts service (query params, export paging, money as strings), money maths,
  error messages, login, dashboard, transactions (debounce, filters, paging, errors), back office, CSV rules.
- **End to end** (Cypress, `cypress/e2e/login-to-transactions.cy.ts`): signed-out redirect → wrong password →
  log in → accounts → transactions → debounced search → filter → a customer can't open `/admin`.
- **CI:** the `portal` job in `.github/workflows/ci.yml` runs the unit tests, the production build (bundle budgets),
  then starts account-service and runs the Cypress test.

## Performance (Lighthouse)

```powershell
npm run serve:prod     # terminal 1: production build on http://127.0.0.1:4300
npm run lighthouse     # terminal 2: writes lighthouse-report.report.html / .json
```

| | Before (eager login, default change detection) | After (all routes lazy, `OnPush`) |
| --- | --- | --- |
| Performance (mobile) | _fill in_ | _fill in_ |
| Initial JS (from `ng build`) | _fill in_ | _fill in_ |

To measure "before", check out the commit `portal: baseline before M2 polish` and run the same two commands.

**Next:** refresh token in an httpOnly cookie; transfers with idempotency keys (M2, issue 6).
