# Wireframe — StockFlow

The layout of every screen, top to bottom, as it is built today.
Routes, access rules and navigation are in [sitemap.md](sitemap.md).

**Last updated:** 2026-09-30 · **Styling:** plain Tailwind plus a few shared classes (`card`, `btn`, `input`, `table`, `num`) in `src/app/globals.css`

## How to read the boxes

| Symbol | Meaning |
|---|---|
| `[Save]` | Button |
| `[          ]` | Text input or textarea |
| `[All ▾]` | Select (dropdown) |
| `!` | Error banner (`ErrorBanner`), with `[Retry]` when retrying makes sense |
| `├─ Card ─┤` | A separate white card (`.card`) |
| `INV-2026-0001`, `250,000.00` | Sample values, for illustration only |

Money is shown with `formatMinor()`: two decimals and thousands separators.

## Contents

1. [Shared building blocks](#1-shared-building-blocks)
2. [/login and /register](#2-login-and-register)
3. [/products](#3-products)
4. [/invoices](#4-invoices)
5. [/invoices/new and /invoices/:id/edit](#5-invoicesnew-and-invoicesidedit)
6. [/invoices/:id](#6-invoicesid)

---

## 1. Shared building blocks

### App shell (every signed-in screen)

```text
┌─ App shell ──────────────────────────────────────────────────────────────────┐
│ StockFlow   Products   Invoices              demo@stockflow.test   [Log out] │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                  screen content (centered, max-w-5xl)                        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Top bar:** `src/components/AppNav.tsx`. The active link is bold blue (`pathname.startsWith(href)`, so `/invoices/:id` highlights *Invoices*).
- **Log out:** calls `POST /api/auth/logout`, clears the query cache, goes to `/login`. The button reads "Logging out…" meanwhile.
- **Content area:** `src/app/(app)/layout.tsx`. It checks the session on the server first, and sends guests to `/login`.
- **Crash fallback:** `src/app/(app)/error.tsx` shows "Something went wrong while showing this page." with `[Retry]`.
- **Mobile:** the email is hidden below the `sm` breakpoint; the links stay on one row.

### Shared UI pieces (`src/components/ui.tsx`)

| Piece | Looks like | Used on |
|---|---|---|
| `ErrorBanner` | Red strip with the message, optional `[Retry]` | Every screen |
| `Field` | Label, control, then a grey hint or a red field error | Every form |
| `Pagination` | `12 total   [‹ Prev] Page 1 of 2 [Next ›]` | /products, /invoices |
| `StatusBadge` | Pill: DRAFT grey · ISSUED blue · PAID green · CANCELLED red | Invoice list and detail |
| `TableMessage` | Centered grey row inside a table (loading or empty) | /products, /invoices |

### Where error messages come from

Forms use `noValidate`, so the browser shows no validation of its own. The text the user sees is the server's `{ message, fields }`, shown as-is: the message in the banner, each `fields` entry under its input (`sku`, `items.0.quantity`, …). The only client-side checks are parsing ones in the product dialog (is the price a number, is the quantity a whole number).

---

## 2. /login and /register

```text
┌─ /login ──────────────────────────────────┐
│ Sign in to StockFlow                      │
│                                           │
│ ! Invalid email or password               │
│                                           │
│ Email                                     │
│ [                                       ] │
│ Password                                  │
│ [                                       ] │
│                                           │
│ [               Sign in                 ] │
│                                           │
│          No account? Register             │
└───────────────────────────────────────────┘
```

The two pages share one component, `AuthForm`. What differs:

| | /login | /register |
|---|---|---|
| Title | Sign in to StockFlow | Create your account |
| Password hint | — | At least 8 characters |
| Button (while busy) | Sign in (Signing in…) | Create account (Creating…) |
| Link under the form | No account? Register | Already registered? Sign in |
| After success | The `?next=` path if it is same-site, otherwise `/products` | `/products` (already signed in) |

| State | What the user sees |
|---|---|
| Submitting | Button disabled, busy label |
| Error | Banner with the server message plus field errors. A failed login always says "Invalid email or password", never which part was wrong |

**Mobile:** the same single narrow column.
**Files:** `src/app/(auth)/layout.tsx` (centered column; signed-in users go to `/products`) · `src/app/(auth)/login/page.tsx` · `src/app/(auth)/register/page.tsx` · `src/components/AuthForm.tsx`

---

## 3. /products

```text
┌─ /products ──────────────────────────────────────────────────────────────────┐
│ Products                                                     [+ New product] │
│ [ Search name or SKU          ]                                              │
│ ! error banner (load failed → [Retry], delete blocked → message)             │
├─ Table ──────────────────────────────────────────────────────────────────────┤
│ SKU      Name                    Unit price   On hand                        │
│ LS-STD   Laptop stand            250,000.00        12        [Edit] [Delete] │
│          Aluminium, adjustable                                               │
│ USB-C1   USB-C cable 1m           45,000.00         0        [Edit] [Delete] │
│                                                    ↑ red at 0                │
├──────────────────────────────────────────────────────────────────────────────┤
│ 12 total                                     [‹ Prev]  Page 1 of 2  [Next ›] │
└──────────────────────────────────────────────────────────────────────────────┘
```

```text
┌─ ProductDialog (modal over /products) ─────────┐
│ New product     (edit: "Edit Laptop stand")    │
│ ! server error, e.g. duplicate SKU             │
│                                                │
│ SKU                                            │
│ [                                            ] │
│ Name                                           │
│ [                                            ] │
│ Description (optional)                         │
│ [                                            ] │
│ Unit price              Quantity on hand       │
│ [ 0.00               ]  [ 0                  ] │
│                                                │
│                               [Cancel]  [Save] │
└────────────────────────────────────────────────┘
```

| Element | Behaviour |
|---|---|
| Search | Debounced; matches name or SKU, case-insensitive; resets to page 1 |
| Table | 10 per page; description shown small under the name; *On hand* is red at 0 |
| `[+ New product]` / `[Edit]` | Open the dialog on the same page (no separate route) |
| Dialog `[Save]` | Sends the form; on success refreshes the list and closes. Clearing *Description* on edit removes it |
| `[Delete]` | Asks `Delete "<name>" (<sku>)? This cannot be undone.` first. If an invoice uses the product the server refuses (409): "This product is used by N invoices and cannot be deleted" |

| State | What the user sees |
|---|---|
| Loading | Table row "Loading products…" |
| Empty | "No products yet. Create your first one." |
| No search match | `No products match "<q>".` |
| Load failed | Banner + `[Retry]` |
| Changing page or search | Previous rows stay, dimmed, until the new page arrives |
| Saving / deleting | "Saving…" button disabled / that row's Delete disabled |

**Mobile:** the table scrolls sideways; in the dialog, price and quantity stack into one column.
**Files:** `src/app/(app)/products/page.tsx` · `src/components/ProductDialog.tsx`

---

## 4. /invoices

```text
┌─ /invoices ──────────────────────────────────────────────────────────────────┐
│ Invoices                                                     [+ New invoice] │
│ Status [All ▾]                                                               │
│ ! error banner + [Retry]                                                     │
├─ Table (whole row is clickable) ─────────────────────────────────────────────┤
│ Number          Customer        Issue date  Due date    Status        Total  │
│ INV-2026-0002   Toko Makmur     2026-09-30  2026-10-30  DRAFT    120,000.00  │
│ INV-2026-0001   Acme Trading    2026-09-28  2026-10-28  ISSUED   555,000.00  │
├──────────────────────────────────────────────────────────────────────────────┤
│ 2 total                                      [‹ Prev]  Page 1 of 1  [Next ›] │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Element | Behaviour |
|---|---|
| Status filter | All · Draft · Issued · Paid · Cancelled; resets to page 1 |
| Table | 10 per page, no line items; clicking a row (or the number) opens `/invoices/:id` |
| `[+ New invoice]` | Goes to `/invoices/new` |

| State | What the user sees |
|---|---|
| Loading | Table row "Loading invoices…" |
| Empty | "No invoices yet. Create your first one." (with a filter: "No draft invoices.", etc.) |
| Load failed | Banner + `[Retry]` |
| Changing page or filter | Previous rows stay, dimmed |

**Mobile:** the table scrolls sideways.
**Files:** `src/app/(app)/invoices/page.tsx`

---

## 5. /invoices/new and /invoices/:id/edit

```text
┌─ /invoices/new   (edit: "Edit INV-2026-0002") ───────────────────────────────┐
│ New invoice                                                                  │
│ ! save error banner          ! products failed to load + [Retry]             │
├─ Card: details ──────────────────────────────────────────────────────────────┤
│ Customer name                                                                │
│ [                                                                          ] │
│ Issue date              Due date                                             │
│ [ 2026-09-30 ]          [ 2026-10-30 ]                                       │
│ Notes (optional)                                                             │
│ [                                                                          ] │
├─ Card: line items ───────────────────────────────────────────────────────────┤
│ Line items                                                                   │
│ [ LS-STD – Laptop stand (12 in stock) ▾ ] [  2 ]  250,000.00  500,000.00 [×] │
│ [ Choose a product…                   ▾ ] [  1 ]           —           — [×] │
│                                           Only 12 in stock  (if qty > stock) │
│ [+ Add line]                                                                 │
│                                                                              │
│                                                   Subtotal        500,000.00 │
│                                                   Tax (11%)        55,000.00 │
│                                                   Total           555,000.00 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                       [Cancel]  [Save draft] │
└──────────────────────────────────────────────────────────────────────────────┘
```

Both routes render the same `InvoiceForm`; edit passes in the existing invoice.

| Element | Behaviour |
|---|---|
| Dates | Issue date defaults to today, due date to 30 days later |
| Product select | Shows `SKU – Name (N in stock)`; loads up to 100 products; a product already on another line is disabled |
| Quantity | Amber "Only N in stock" warning while typing. Only a hint: the server makes the real check |
| Unit price | The product's current price. On edit, lines already on the invoice keep their snapshot price |
| `[×]` | Removes the line; disabled when only one line is left |
| Totals | Live preview from `computeTotals()`, the same function the server uses; "—" until it can be computed |
| Save | "Save draft" (new) / "Save changes" (edit) → the invoice's detail page |
| Cancel | Back to `/invoices` (new) or to the invoice (edit) |

| State | What the user sees |
|---|---|
| Loading products | "Loading products…" above the lines |
| No products yet | "You have no products yet. Add some first." (links to `/products`) |
| Save failed | Banner + errors under the exact field or line, e.g. over-stock on `items.0.quantity` |
| Saving | "Saving…" button disabled |
| Edit: loading | "Loading invoice…" |
| Edit: not a draft | "Only draft invoices can be edited. This one is issued." + `[← Back to invoice]` (the API would also refuse with 409) |

**Mobile:** the details card becomes one column. Each line item turns into a 2-column grid: product on its own row, then quantity, price, total and `[×]`. The *Product* / *Quantity* labels are visible on mobile only (screen-reader-only on desktop).
**Files:** `src/app/(app)/invoices/new/page.tsx` (server component; reads the tax rate from env) · `src/app/(app)/invoices/[id]/edit/page.tsx` · `src/components/EditInvoice.tsx` · `src/components/InvoiceForm.tsx`

---

## 6. /invoices/:id

```text
┌─ /invoices/:id ──────────────────────────────────────────────────────────────┐
│ ← Invoices                                                                   │
│ INV-2026-0002  [DRAFT]                     [Edit]  [Issue]  [Cancel invoice] │
│ ! transition error, e.g. insufficient stock for "Laptop stand"               │
├─ Card: details ──────────────────────────────────────────────────────────────┤
│ Customer               Issue date             Due date                       │
│ Toko Makmur            2026-09-30             2026-10-30                     │
│ Notes                                                                        │
│ Deliver before noon                                                          │
├─ Card: items (snapshots taken when each line was added) ─────────────────────┤
│ Product            SKU        Unit price     Qty     Line total              │
│ Laptop stand       LS-STD     250,000.00       2     500,000.00              │
│                                                                              │
│                                                   Subtotal        500,000.00 │
│                                                   Tax (11%)        55,000.00 │
│                                                   Total           555,000.00 │
└──────────────────────────────────────────────────────────────────────────────┘
```

Buttons depend on the status. They come from `ALLOWED_TRANSITIONS` in `src/lib/invoice-status.ts`, the same table the server enforces:

| Status | Buttons | Confirm first |
|---|---|---|
| DRAFT | Edit · Issue · Cancel invoice | Issue: "Issue this invoice? Stock will be deducted for every line." · Cancel: "Cancel this draft invoice?" |
| ISSUED | Mark paid · Cancel invoice | Cancel: "Cancel this invoice? Its stock will be returned." · Mark paid: no confirm |
| PAID, CANCELLED | none | — |

After an action the page updates in place from the server's answer, and the invoice list and product caches are refreshed (stock changed).

| State | What the user sees |
|---|---|
| Loading | "Loading invoice…" |
| Not found (or another user's) | "Invoice not found." + `[← Back to invoices]` |
| Other load error | Banner + `[Retry]` |
| Action running | The clicked button reads "Working…"; all action buttons disabled |
| Action failed | Banner with the server message, e.g. not enough stock to issue, naming the product |

The tax line uses the rate stored on the invoice (`taxRateBps`), not today's `TAX_RATE`.

**Mobile:** the details card becomes one column; action buttons wrap; the table scrolls sideways.
**Files:** `src/app/(app)/invoices/[id]/page.tsx` · `src/components/InvoiceDetail.tsx` · `src/components/use-invoice.ts`
