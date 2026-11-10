# Customer portal (Angular)

Angular 19 single-page app for the card banking platform: log in, see accounts and balances, browse and filter
transactions, export them to CSV. It talks to [account-service](../services/account-service) through `/api`.

```powershell
# 1. Start the API (another terminal):  cd ..\services\account-service ; .\mvnw.cmd spring-boot:run
# 2. Then:
npm install
npm start          # http://localhost:4200  (proxies /api to localhost:8080, so no CORS setup is needed)
npm test           # unit tests in Chrome, re-runs on save
npm run test:ci    # once, headless (what CI runs)
npm run build      # production build in dist/portal
```

Demo logins: `alex.morgan@example.com` / `alex-demo-password`, `priya.shah@example.com` / `priya-demo-password`.

## How it's built

| Piece | File | What it does |
| --- | --- | --- |
| Auth state | `core/auth.service.ts` | Login, refresh, logout. Access token in memory only (signals); refresh token in `sessionStorage`. `refresh()` is single-flight, so many 401s at once cause one refresh call |
| Interceptor | `core/auth.interceptor.ts` | Adds `Authorization: Bearer …` to `/api` calls only (never to the auth endpoints or other sites). On a 401: refresh once, retry; if that fails, log out |
| Route guard | `core/auth.guard.ts` | Protects every page except `/login`; restores the session after a reload; sends others to `/login?returnUrl=…`, and only same-site return URLs are honoured (no open redirect) |
| Login | `login/` | Reactive form with validation; clear messages for wrong password (401), locked account (423) and server down |
| Accounts | `dashboard/` | Cards per account with masked number and balance, plus the total |
| Transactions | `transactions/` | Date range, money in/out and text filters; paging; CSV export of every matching row |
| CSV | `core/csv.ts` | RFC 4180 quoting, UTF-8 BOM for Excel, and formula neutralising so a merchant name like `=HYPERLINK(…)` can't run in a spreadsheet (CSV injection) |

Standalone components, signals, the new `@if` / `@for` control flow, lazy-loaded routes, functional guards and
interceptors, strict TypeScript and strict templates.

**Accessibility:** a skip link, labelled inputs, `aria-invalid` with linked error text, `aria-live` regions for
errors and loading, a table with column headers, visible focus outlines, and colour contrast within WCAG AA.

**Tests** (Jasmine + Karma): auth service (token storage, single-flight refresh, reload restore, logout),
interceptor (header rules, refresh-and-retry, logout on failed refresh), guard and return-URL safety, login form,
dashboard, transactions page (filters, paging, empty state) and CSV rules.

**Next:** store the refresh token in an httpOnly, SameSite cookie set by the API, so page scripts can't read it at
all; add transfers with idempotency keys (M2, issue 6).
