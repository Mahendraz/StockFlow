# Sitemap — StockFlow

Every page in the app: who can open it, where it leads, and which file builds it.
The layout of each screen is in [wireframe.md](wireframe.md).

| | |
|---|---|
| **Last updated** | 2026-09-30 |
| **Stack** | Next.js 16 (App Router) · MongoDB via Mongoose · TanStack Query |
| **Routes live in** | `src/app/`: route groups `(auth)` and `(app)`, JSON API under `src/app/api/` |

## Contents

1. [Route map](#1-route-map)
2. [Access and redirects](#2-access-and-redirects)
3. [Navigation](#3-navigation)
4. [Screens](#4-screens)
5. [Main flow](#5-main-flow)
6. [JSON API](#6-json-api)
7. [Not built](#7-not-built)

---

## 1. Route map

```text
/                          → redirects to /products

(auth)                     guests only
├── /login                 Sign in
└── /register              Create an account

(app)                      sign-in required
├── /products              Products: list, search, create, edit, delete
└── /invoices              Invoices: list, filter by status
    ├── /new               New invoice
    └── /:id               Invoice detail + status actions
        └── /edit          Edit invoice (DRAFT only)
```

A folder in parentheses is a route group: it picks the layout but doesn't appear in the URL.

| Route | Screen | Who | Page file |
|---|---|---|---|
| `/` | Redirect to `/products` | Anyone | `src/app/page.tsx` |
| `/login` | Sign in | Guests | `src/app/(auth)/login/page.tsx` |
| `/register` | Create an account | Guests | `src/app/(auth)/register/page.tsx` |
| `/products` | Products | Signed in | `src/app/(app)/products/page.tsx` |
| `/invoices` | Invoices | Signed in | `src/app/(app)/invoices/page.tsx` |
| `/invoices/new` | New invoice | Signed in | `src/app/(app)/invoices/new/page.tsx` |
| `/invoices/:id` | Invoice detail | Signed in | `src/app/(app)/invoices/[id]/page.tsx` |
| `/invoices/:id/edit` | Edit invoice | Signed in | `src/app/(app)/invoices/[id]/edit/page.tsx` |

### Layouts and boundaries

| File | Wraps | What it does |
|---|---|---|
| `src/app/layout.tsx` | Everything | `<html>`, global CSS, `Providers` (the TanStack Query client) |
| `src/app/(auth)/layout.tsx` | /login, /register | Narrow centered column; sends signed-in users to `/products` |
| `src/app/(app)/layout.tsx` | Every app screen | Checks the session on the server (`getCurrentUser()`), sends guests to `/login`, renders the top bar |
| `src/app/(app)/error.tsx` | Every app screen | Catches unexpected render errors: message + `[Retry]` |

---

## 2. Access and redirects

| Situation | What happens | Handled in |
|---|---|---|
| A guest opens an app screen | Redirected to `/login` | `src/app/(app)/layout.tsx` |
| A signed-in user opens `/login` or `/register` | Redirected to `/products` | `src/app/(auth)/layout.tsx` |
| Sign-in succeeds | Goes to `?next=` if it is a same-site path, otherwise `/products` | `src/components/AuthForm.tsx`, `src/lib/safe-next.ts` |
| Registration succeeds | Already signed in, goes to `/products` | `src/components/AuthForm.tsx` |
| The session expires mid-use | The next API call gets 401 → full reload to `/login?next=<current page>` | `src/lib/api-client.ts` |
| Log out | Session deleted on the server, query cache cleared, → `/login` | `src/components/AppNav.tsx` |
| Opening another user's invoice | "Invoice not found." (the API answers 404) | `src/components/InvoiceDetail.tsx` |

- **Roles:** one role. Every user is their own workspace.
- **Where security lives:** the API checks the session on every request and answers 401 on its own. The page redirects above only keep the UI tidy; they are not the security boundary.

---

## 3. Navigation

The top bar on every app screen (`src/components/AppNav.tsx`):

```text
StockFlow   Products   Invoices                    demo@stockflow.test   [Log out]
```

- **Active link:** bold blue, matched with `pathname.startsWith(href)`, so `/invoices/:id` still highlights *Invoices*.
- **Mobile:** same bar; the email is hidden below the `sm` breakpoint. No hamburger menu.
- **Auth pages:** no bar. Each form links to the other ("Register" ↔ "Sign in").
- **Footer:** none.

### Links inside pages

| From | Element | Goes to |
|---|---|---|
| /products | `[+ New product]`, `[Edit]` | A dialog on the same page (no route) |
| /invoices | `[+ New invoice]` | /invoices/new |
| /invoices | A row, or its invoice number | /invoices/:id |
| /invoices/new | `[Save draft]` | /invoices/:id of the new invoice |
| /invoices/new | `[Cancel]` | /invoices |
| /invoices/new (no products yet) | "Add some first" | /products |
| /invoices/:id | `← Invoices` | /invoices |
| /invoices/:id | `[Edit]` (DRAFT only) | /invoices/:id/edit |
| /invoices/:id/edit | `[Save changes]`, `[Cancel]` | /invoices/:id |

---

## 4. Screens

### /login and /register

- **Purpose:** sign in, or create an account (which signs you in right away).
- **Shows:** email, password (register adds the hint "At least 8 characters"), server errors as-is.
- **Rule you can see:** a failed login always says "Invalid email or password", never which part was wrong.
- **Files:** `src/app/(auth)/login/page.tsx` · `src/app/(auth)/register/page.tsx` · `src/components/AuthForm.tsx`

### /products

- **Purpose:** keep the product list and the stock on hand.
- **Shows:** SKU, name (+ description), unit price, on hand (red at 0). 10 per page.
- **Actions:** search by name or SKU · paginate · `[+ New product]` · Edit · Delete.
- **Rules you can see:** a duplicate SKU is refused on the SKU field (409). Deleting a product that any invoice uses is refused with a message (409 `PRODUCT_IN_USE`).
- **Files:** `src/app/(app)/products/page.tsx` · `src/components/ProductDialog.tsx`

### /invoices

- **Purpose:** find an invoice.
- **Shows:** number, customer, issue date, due date, status badge, total. 10 per page.
- **Actions:** filter by status (All, Draft, Issued, Paid, Cancelled) · paginate · open an invoice · `[+ New invoice]`.
- **Files:** `src/app/(app)/invoices/page.tsx`

### /invoices/new

- **Purpose:** create an invoice as a DRAFT. Stock does not change yet.
- **Shows:** customer name, issue date (today), due date (+30 days), notes, line items, live subtotal / tax / total.
- **Actions:** add or remove lines, pick a product, set a quantity, `[Save draft]`.
- **Rules you can see:** a warning while a quantity is over stock; on save, the server refuses over-stock lines with an error naming the product (409). The totals preview uses the same `computeTotals()` as the server.
- **Files:** `src/app/(app)/invoices/new/page.tsx` (server component; reads the tax rate) · `src/components/InvoiceForm.tsx`

### /invoices/:id

- **Purpose:** read an invoice and move it through its lifecycle.
- **Shows:** number, status badge, customer, dates, notes, line items (name, SKU and price as snapshotted), subtotal, tax at the invoice's stored rate, total.
- **Actions:** depend on the status:

| Status | Buttons | Effect on stock |
|---|---|---|
| DRAFT | Edit · Issue · Cancel invoice | Issue takes the stock for every line, all or nothing |
| ISSUED | Mark paid · Cancel invoice | Cancel puts the stock back |
| PAID, CANCELLED | none | Final states |

- **Files:** `src/app/(app)/invoices/[id]/page.tsx` · `src/components/InvoiceDetail.tsx` · `src/components/use-invoice.ts`

### /invoices/:id/edit

- **Purpose:** change a DRAFT invoice.
- **Shows:** the same form as *New invoice*, filled in. Lines already on the invoice keep their snapshot price.
- **Not a draft:** "Only draft invoices can be edited" with a link back. The API refuses too (409 `INVOICE_NOT_EDITABLE`).
- **Files:** `src/app/(app)/invoices/[id]/edit/page.tsx` · `src/components/EditInvoice.tsx` · `src/components/InvoiceForm.tsx`

---

## 5. Main flow

```text
Sign in
  └─▶ /products          add products with their stock
  └─▶ /invoices          [+ New invoice]
        └─▶ /invoices/new    customer + lines → [Save draft]        DRAFT     stock unchanged
              └─▶ /invoices/:id  [Issue]                            ISSUED    stock goes down
                    ├─▶ [Mark paid]                                 PAID      done
                    └─▶ [Cancel invoice]                            CANCELLED stock comes back
```

---

## 6. JSON API

The pages call these endpoints through `src/lib/api-client.ts`. Request and response shapes, and every error code, are in the README under **API**.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` |
| Products | `GET, POST /api/products` · `GET, PATCH, DELETE /api/products/:id` |
| Invoices | `GET, POST /api/invoices` · `GET, PATCH /api/invoices/:id` · `POST /api/invoices/:id/issue`, `/pay`, `/cancel` |

Route handlers live in `src/app/api/`; the business rules they call live in `src/server/*/*.service.ts`.

---

## 7. Not built

- Nothing approved is waiting to be built.
- Ideas from the README ("With one more week"): a stock-movement ledger with delta stock adjustments, E2E tests and CI, an invoice print/PDF view, a searchable product picker, filters kept in the URL.
- Deliberately absent: footer, profile or settings page, password reset (out of scope in the brief).
