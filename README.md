# StockFlow

A minimal inventory and invoicing app. Staff sign in, keep a product list with stock on
hand, and raise invoices. Issuing an invoice takes the stock out; cancelling an issued
invoice puts it back.

Next.js 16 (App Router, TypeScript) for both the UI and the API, MongoDB 7 via Mongoose.

---

## Quick start

**Prerequisites:** Node.js **20.19+** (developed on Node 24) and npm. For the database,
either **Docker** *or* nothing extra (see option B).

```bash
git clone https://github.com/Mahendraz/StockFlow.git stockflow && cd stockflow
npm install
cp .env.example .env            # Windows (cmd): copy .env.example .env
```

Start MongoDB, using **one** of these:

```bash
# A) Docker: single-node replica set on :27017, waits until healthy
npm run db:up

# B) No Docker: same replica set on :27017 using a MongoDB binary downloaded by npm
#    (first run downloads ~600 MB once; keep this terminal open)
npm run db:local
```

Then, in another terminal:

```bash
npm run db:seed                 # demo user + 8 products + 2 invoices
npm run dev                     # http://localhost:3000
```

### Demo login

| Email | Password |
|---|---|
| `demo@stockflow.test` | `Demo12345!` |

`npm run db:seed` can be re-run at any time. It resets only the demo account.

> There are no migrations to run. MongoDB has no schema migrations here; collections and
> indexes (including the unique ones) are created by the app on its first connection
> (`src/server/db.ts`).

### Tests

```bash
npm test
```

The tests need **no running database**. They start their own throwaway in-memory MongoDB
replica set (the first run downloads the MongoDB binary, like `db:local`).

### All scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server on :3000 |
| `npm run build` / `npm start` | Production build / serve it |
| `npm test` | Vitest integration + unit tests |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:up` / `npm run db:down` | Start / stop MongoDB in Docker |
| `npm run db:local` | Start MongoDB without Docker (data in `.data/`) |
| `npm run db:seed` | Create the demo account and data |

### Environment variables

All of them are in `.env.example`, with safe local values.

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `MONGODB_URI` | yes | | Must point at a **replica set** (transactions). The example matches both `db:up` and `db:local`. |
| `TAX_RATE` | no | `0.11` | Tax on the invoice subtotal, as a fraction with up to 4 decimals. |
| `SESSION_TTL_HOURS` | no | `12` | How long a login lasts. |
| `BCRYPT_COST` | no | `12` | bcrypt work factor (4–15). Tests use 4 for speed. |

Env vars are validated with zod on first use (`src/server/env.ts`), so a bad value fails
loudly instead of being silently ignored.

---

## How it is built

```
src/
  app/
    (auth)/login, register       sign-in pages (redirect to the app if already signed in)
    (app)/...                    authenticated shell: products, invoices (+ new, [id], [id]/edit)
    api/...                      JSON API: thin route handlers
  server/                        backend only
    auth/                        sessions, cookie, login rate limit
    products/, invoices/         *.schemas.ts (zod input) + *.service.ts (business rules)
    models/                      Mongoose schemas + indexes
    db.ts, env.ts, errors.ts, http.ts, validation.ts
  lib/                           shared by server and browser (pure functions)
    money.ts                     integer money math
    invoice-status.ts            the status machine (one table)
    invoice-totals.ts            the one place totals are computed
  components/                    React UI
tests/                           Vitest; route handlers called directly with real Requests
```

A request goes **route handler → service → Mongoose**. Route handlers only parse input
and shape the response. Every business rule lives in a service function that takes the
signed-in `userId` as its first argument. `handler()` / `authedHandler()` in
`src/server/http.ts` wrap each route: they connect to the DB, require a valid session
(authed routes only), and turn any thrown error into the standard error response.

### Business rules and where they live

| Rule | How | Where |
|---|---|---|
| Money is never a float | All amounts are **integer minor units** (1/100): `1250050` = 12,500.50. Multiplication and sums go through `BigInt`; tax is rounded half-up with integer math. `TAX_RATE` is parsed as a string into basis points (`0.11` → `1100`). | `src/lib/money.ts` |
| Server computes totals | `lineTotal`, `subtotal`, `taxAmount` and `total` come from `computeTotals()`. The input schema has no total fields, so anything the client sends for them is dropped. The UI calls the same function for its live preview only. | `src/lib/invoice-totals.ts`, `invoice.schemas.ts` |
| Tax on the subtotal | Once, on the subtotal (not per line). The rate is stored on each invoice (`taxRateBps`), so changing `TAX_RATE` later does not change existing invoices. | `invoice.service.ts` |
| Price/name snapshots | Each line copies the product's name, SKU and unit price when the line is **added**. Later product edits never touch invoices. When a draft is edited, lines that were already there keep their original snapshot. | `buildItems()` |
| Stock guard | A line cannot exceed `quantityOnHand`. This is checked when a draft is created/edited (so the form fails fast, naming the product), and **again when the invoice is issued**, because drafts do not reserve stock. | `buildItems()`, `consumeStock()` |
| Atomic issue | `DRAFT → ISSUED` runs in a **MongoDB transaction**. Each line does `updateOne({ quantityOnHand: { $gte: qty } }, { $inc: -qty })`. If any line matches nothing, the whole transaction aborts, so it is all lines or none. | `changeStatus()`, `consumeStock()` |
| Concurrency *(bonus)* | The `$gte` filter makes negative stock impossible even when two invoices compete for the last units. The status change is conditional on the status that was read (`{ status: from }`), so one invoice cannot be issued twice. MongoDB write conflicts between transactions are retried by the driver. Both cases are tested. | same |
| Cancel restores stock | `ISSUED → CANCELLED` increments the stock back in the same transaction. `DRAFT → CANCELLED` touches no stock. | `restoreStock()` |
| Status machine | `DRAFT → ISSUED → PAID`, `DRAFT → CANCELLED`, `ISSUED → CANCELLED`. `PAID` and `CANCELLED` are terminal. Everything else returns `409 INVALID_TRANSITION`. The UI builds its buttons from the same table. | `src/lib/invoice-status.ts` |
| Draft-only edits | `PATCH /api/invoices/:id` returns `409 INVOICE_NOT_EDITABLE` unless the invoice is `DRAFT`. | `updateInvoice()` |
| Product delete (I4) | **Blocked**, not soft-deleted: `409 PRODUCT_IN_USE` if any invoice line references the product. This keeps the data model simple (no "deleted" flag that every query must remember). Invoices keep their own snapshots anyway. | `deleteProduct()` |
| Invoice numbers | `INV-YYYY-NNNN`, per user per year, from a counter document incremented with an atomic `$inc` inside the create transaction, so there are no duplicates and no gaps. | `nextInvoiceNumber()` |
| SKU uniqueness | Unique **per user** (compound index `{ userId, sku }`), stored upper-cased so `abc-1` and `ABC-1` collide. | `models/product.ts` |

### Authentication

- **Passwords:** bcrypt (`bcryptjs`, cost 12). Each hash embeds its own random salt. The
  policy (8 to 72 bytes; bcrypt ignores anything past 72) is enforced by the server's zod
  schema, not just the form.
- **Sessions:** login creates a random 256-bit token. The browser gets it in an
  **httpOnly, SameSite=Lax** cookie (`Secure` in production). The database stores only
  its **SHA-256**, in a `sessions` collection with a TTL index for expiry.
- **Logout really logs out:** it deletes the session document, so a copied cookie stops
  working immediately. This is why I chose server-side sessions over a stateless JWT.
- **401 everywhere:** every product and invoice route goes through `authedHandler()`.
  Tests call each endpoint without a cookie and expect 401. The `(app)` layout also
  checks the session on the server and redirects to `/login`.
- **No account enumeration on login:** an unknown email and a wrong password return the
  same `401 INVALID_CREDENTIALS` body. For an unknown email the server still runs a bcrypt
  compare against a dummy hash, so response timing doesn't reveal it either.
- **Per-user data (A7):** every query filters by `userId`. Another user's product or
  invoice returns **404**, not 403, so its existence is not revealed.
- **Login rate limit** *(bonus)*: after 10 failed logins per (IP, email) within 15
  minutes, the server returns `429` with `Retry-After`. A successful login resets the count.
- **CSRF:** SameSite=Lax keeps the cookie off cross-site POST/PATCH/DELETE requests.
- **Secrets:** `.env` is git-ignored; only `.env.example` is committed. There is no JWT
  secret to manage, because session tokens are random rather than signed.

---

## API

All endpoints take and return JSON. Money is in **integer minor units**. Dates are `YYYY-MM-DD`.

| Method | Path | Auth | Description | Success |
|---|---|---|---|---|
| POST | `/api/auth/register` | – | `{ email, password }`. Creates the user and signs them in (sets the cookie). | 201 `{ user }` |
| POST | `/api/auth/login` | – | `{ email, password }`. Sets the session cookie. | 200 `{ user }` |
| POST | `/api/auth/logout` | – | Deletes the session and clears the cookie. Idempotent. | 204 |
| GET | `/api/auth/me` | ✔ | The current user. | 200 `{ user }` |
| GET | `/api/products?q=&page=&pageSize=` | ✔ | List; `q` searches name or SKU (case-insensitive). `pageSize` is at most 100. | 200 page |
| POST | `/api/products` | ✔ | `{ sku, name, description?, unitPrice, quantityOnHand }` | 201 `{ data }` |
| GET | `/api/products/:id` | ✔ | One product. | 200 `{ data }` |
| PATCH | `/api/products/:id` | ✔ | Any subset of the create fields. | 200 `{ data }` |
| DELETE | `/api/products/:id` | ✔ | 409 if any invoice uses it. | 204 |
| GET | `/api/invoices?status=&page=&pageSize=` | ✔ | List (no line items); optional status filter. | 200 page |
| POST | `/api/invoices` | ✔ | `{ customerName, issueDate?, dueDate?, notes?, items: [{ productId, quantity }] }`. Created as `DRAFT`. `issueDate` defaults to today, `dueDate` to +30 days. | 201 `{ data }` |
| GET | `/api/invoices/:id` | ✔ | Invoice with line items and totals. | 200 `{ data }` |
| PATCH | `/api/invoices/:id` | ✔ | Same fields as create, all optional. `DRAFT` only. | 200 `{ data }` |
| POST | `/api/invoices/:id/issue` | ✔ | `DRAFT → ISSUED`, takes stock. | 200 `{ data }` |
| POST | `/api/invoices/:id/pay` | ✔ | `ISSUED → PAID`. | 200 `{ data }` |
| POST | `/api/invoices/:id/cancel` | ✔ | `DRAFT/ISSUED → CANCELLED`. Returns stock if the invoice was issued. | 200 `{ data }` |

**Page shape:** `{ data: [...], page, pageSize, total, totalPages }`

**Every error has the same shape:**

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Insufficient stock for \"Laptop stand\" (SKU LS-STD): requested 5, available 3",
    "fields": { "items.0.quantity": ["Insufficient stock for ..."] }
  }
}
```

| Status | Codes |
|---|---|
| 400 | `INVALID_JSON` |
| 401 | `UNAUTHORIZED` (no/expired session), `INVALID_CREDENTIALS` |
| 404 | `NOT_FOUND` (also another user's resource, or a malformed id) |
| 409 | `DUPLICATE` (e.g. SKU), `EMAIL_TAKEN`, `INSUFFICIENT_STOCK`, `INVALID_TRANSITION`, `INVOICE_NOT_EDITABLE`, `PRODUCT_IN_USE` |
| 422 | `VALIDATION_ERROR`, with `fields` keyed by path (`sku`, `items.1.productId`, …) |
| 429 | `RATE_LIMITED` (with `Retry-After`) |
| 500 | `INTERNAL_ERROR`. Details are logged on the server and never sent to the client. |

*Why 409 for insufficient stock and duplicate SKUs:* the request is well-formed; it
conflicts with the current state of the data (stock on hand, or another product that
already has that SKU). When a form field is involved, the 409 still carries `fields`
(`sku`, `items.0.quantity`) so the form can show the message next to that input. 422 is
reserved for input that is invalid no matter what the data looks like.

---

## Tests

36 tests in `tests/`. Route handlers are imported and called with real `NextRequest`
objects, against a real (in-memory) MongoDB replica set, so they exercise validation,
auth, transactions and the error mapping end to end.

The five the brief requires:

| Required | Test |
|---|---|
| (a) wrong password rejected | `auth.test.ts`: *rejects a wrong password with a generic 401…* |
| (b) unauthenticated → 401 | `auth.test.ts` (`/me`), plus every product and invoice endpoint in `products.test.ts` / `invoices.test.ts` |
| (c) over-stock invoice rejected | `invoices.test.ts`: *(c) rejects invoicing more than the available stock, naming the product* |
| (d) issuing decrements stock | `invoices.test.ts`: *(d) issuing decrements stock for every line* |
| (e) cancelling restores stock | `invoices.test.ts`: *(e) cancelling an issued invoice restores its stock…* |

Also covered: totals and half-up tax rounding, clients' totals ignored, all-or-nothing
rollback when one line is short, two concurrent issues competing for the same stock,
double-issuing one invoice, every illegal transition, price snapshots, draft-only edits,
impossible dates (422, not 500), the product delete guard, cross-user isolation,
duplicate SKU, clearing a description, search and pagination, logout invalidating the
session, the login rate limit, and the money helpers.

---

## Tech choices and why

- **Next.js full-stack (App Router + Route Handlers).** One process and one `npm run
  dev`. The API is still a plain JSON API with its own auth, so the UI has no special access.
- **TypeScript + zod.** Input is validated at the API boundary into typed values, and zod
  gives field-level messages (`items.1.quantity`) for free.
- **MongoDB + Mongoose.** Line items are embedded in the invoice: a snapshot belongs to
  exactly one invoice and is always read with it, which is a natural document shape.
  Products live in their own collection because stock is shared across invoices.
- **Replica set, even locally.** Issuing has to update several product documents all or
  nothing, which needs multi-document transactions, and those require a replica set.
  `docker-compose.yml` and `db:local` both start a single-node one.
- **Integer minor units for money.** They are simpler and faster than `Decimal128`, which
  has no arithmetic in JavaScript. `BigInt` guards against overflow.
- **Server-side sessions over JWT.** Logout must really invalidate the credential (A3),
  and with a stored session that is a single delete. A JWT would need a denylist, which
  makes it stateful anyway.
- **Services hold the rules; route handlers stay thin.** Business logic can be read,
  tested and changed in one file per module without touching HTTP code.
- **TanStack Query in the UI.** Loading, error and retry states and cache invalidation
  (e.g. refreshing stock after issuing) come without hand-written effect code.
- **Vitest + mongodb-memory-server.** Tests use real MongoDB semantics (unique indexes,
  transactions, write conflicts) with no Docker and no shared dev database.
- **Plain Tailwind.** A few shared classes, no component kit, as the brief asks.

## Trade-offs and known limitations

- **Drafts do not reserve stock.** Stock is only taken when an invoice is issued, and the
  guard runs again at that point. So a draft that was valid when saved can fail to issue
  later, with a clear message naming the product.
- **Stock edits are absolute.** Setting `quantityOnHand` on a product overwrites the
  value. If an invoice is issued between loading the edit form and saving it, that
  decrement is overwritten. A stock-adjustment endpoint (`+/- n` with a reason, i.e. a
  ledger) would fix this; it is the first item below.
- **Rate limiting is in-memory**, so it is per server process. Several instances would
  need a shared store (Redis). It trusts `X-Forwarded-For`, which is only correct behind
  a proxy that sets it.
- **Registration reveals whether an email exists** (`409 EMAIL_TAKEN`). That is hard to
  avoid when email must be unique and there is no email verification (out of scope).
  Registration is not rate-limited.
- **Sessions have a fixed lifetime** (12 h, no sliding renewal) and there is no "log out
  everywhere" button, although the session collection would make that a one-line query.
- **The invoice product picker loads at most 100 products.** A searchable picker would be
  needed beyond that.
- **Draft edits use the current tax rate**, while each saved invoice stores the rate it
  was calculated with.
- **Invoices cannot be deleted.** Cancelling is the way to void one, which keeps
  numbering and history intact.
- **Single currency,** always two minor-unit digits.
- **After signing in you land on `/products`,** even if you first opened another page
  while signed out (the `?next=` return path is only used when a session expires mid-use).
- **No E2E tests.** I checked the UI by hand in a browser (login, product CRUD, invoice
  with live totals, over-stock error, issue → stock drops, delete guard, status filter,
  logout). Automated coverage is at the API level.

## With one more week

1. **Stock-movement ledger:** an append-only record of every change with a reason
   (invoice issued, cancelled, manual adjustment), written in the same transaction, plus
   a delta-based "adjust stock" action in place of absolute edits.
2. **E2E tests** (Playwright) for the main flows, and a **CI** workflow running lint,
   typecheck and tests on every push.
3. Session renewal plus "log out all devices"; rate limits for registration; a Redis-backed limiter.
4. Keep list filters, search and page in the URL, so the back button and shared links work.
5. Invoice print/PDF view, and a searchable product picker on the invoice form.
6. `docker compose up` for the whole app, not just the database.

## AI Usage

- **Tool:** Claude Code (Anthropic's Claude), in the terminal.
- **Planning:** helped pick the stack and sketch the screens before any code was written.
- **Building:** wrote most of the code, tests and this README, one feature per commit.
- **Checking:** reviewed the finished app against the brief (fresh clone, HTTP smoke test,
  browser walkthrough). It found two bugs, now fixed with tests: impossible dates returned
  500, and a product description could not be cleared.
- **My part:** I chose the approach, reviewed the changes and ran the app and tests myself.

## Time spent

About 5 hours, including reviewing and testing.

## Submission checklist

- [x] `git clone` → follow README → app runs, with no undocumented steps (see [Quick start](#quick-start))
- [x] `.env.example` present; no real secrets committed (`.env` is git-ignored)
- [x] Seed script works; demo credentials in README (`npm run db:seed`, [Demo login](#demo-login))
- [x] Register → login → logout works (`auth.test.ts`; logout deletes the session server-side)
- [x] Protected endpoints return 401 without a credential (every endpoint tested in `products.test.ts` / `invoices.test.ts`)
- [x] Products: create, list, search, paginate, update, delete (`products.test.ts`, `/products` screen)
- [x] Invoice: create with multiple lines, correct subtotal / tax / total (`invoices.test.ts`, server-side `computeTotals`)
- [x] Cannot invoice more than stock on hand (`409 INSUFFICIENT_STOCK`, checked on create/edit and again on issue)
- [x] Issuing decrements stock; cancelling an issued invoice restores it (atomic, in one transaction)
- [x] Illegal status transitions are rejected (`409 INVALID_TRANSITION`)
- [x] Changing a product price does not alter an existing invoice (line snapshots)
- [x] Tests run with a single documented command and pass (`npm test`, 36 tests)
- [x] More than one commit, with readable messages
