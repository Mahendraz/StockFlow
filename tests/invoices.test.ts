import { beforeEach, describe, expect, it } from "vitest";
import { POST as cancel } from "@/app/api/invoices/[id]/cancel/route";
import { POST as issue } from "@/app/api/invoices/[id]/issue/route";
import { POST as pay } from "@/app/api/invoices/[id]/pay/route";
import { GET as getInvoice, PATCH as patchInvoice } from "@/app/api/invoices/[id]/route";
import { GET as listInvoices, POST as createInvoice } from "@/app/api/invoices/route";
import { GET as getProduct, PATCH as patchProduct } from "@/app/api/products/[id]/route";
import { POST as createProduct } from "@/app/api/products/route";
import { DELETE as deleteProduct } from "@/app/api/products/[id]/route";
import { idCtx, makeRequest, signUp } from "./helpers";

let cookie: string;

async function product(sku: string, unitPrice: number, quantityOnHand: number) {
  const res = await createProduct(
    makeRequest("POST", "/api/products", { cookie, body: { sku, name: `Product ${sku}`, unitPrice, quantityOnHand } }),
    undefined,
  );
  return (await res.json()).data.id as string;
}

async function stockOf(id: string) {
  const res = await getProduct(makeRequest("GET", `/api/products/${id}`, { cookie }), idCtx(id));
  return (await res.json()).data.quantityOnHand as number;
}

function create(body: Record<string, unknown>) {
  return createInvoice(makeRequest("POST", "/api/invoices", { cookie, body }), undefined);
}

async function draft(items: { productId: string; quantity: number }[]) {
  const res = await create({ customerName: "Acme Ltd", items });
  expect(res.status).toBe(201);
  return (await res.json()).data;
}

const action = (fn: typeof issue, id: string) => fn(makeRequest("POST", `/api/invoices/${id}/x`, { cookie }), idCtx(id));

describe("invoices", () => {
  beforeEach(async () => {
    ({ cookie } = await signUp());
  });

  it("computes line totals, subtotal, 11% tax and total on the server, ignoring client totals", async () => {
    const a = await product("A", 150000, 10); // 1,500.00
    const b = await product("B", 33333, 10); // 333.33
    const res = await create({
      customerName: "Acme Ltd",
      items: [
        { productId: a, quantity: 2, lineTotal: 1, unitPrice: 1 },
        { productId: b, quantity: 3 },
      ],
      subtotal: 1,
      taxAmount: 0,
      total: 1,
    });
    expect(res.status).toBe(201);
    const { data } = await res.json();

    expect(data.invoiceNumber).toMatch(/^INV-\d{4}-0001$/);
    expect(data.status).toBe("DRAFT");
    expect(data.items.map((i: { lineTotal: number }) => i.lineTotal)).toEqual([300000, 99999]);
    expect(data.subtotal).toBe(399999);
    expect(data.taxRateBps).toBe(1100);
    expect(data.taxAmount).toBe(44000); // 43,999.89 rounded half-up to 44,000 minor units
    expect(data.total).toBe(443999);
  });

  it("numbers invoices sequentially per user", async () => {
    const a = await product("A", 100, 10);
    const first = await draft([{ productId: a, quantity: 1 }]);
    const second = await draft([{ productId: a, quantity: 1 }]);
    expect(second.invoiceNumber.slice(-4)).toBe("0002");
    expect(first.invoiceNumber.slice(0, 9)).toBe(second.invoiceNumber.slice(0, 9));
  });

  it("(c) rejects invoicing more than the available stock, naming the product", async () => {
    const a = await product("A", 100, 3);
    const res = await create({ customerName: "Acme Ltd", items: [{ productId: a, quantity: 4 }] });
    expect(res.status).toBe(409);
    const { error } = await res.json();
    expect(error.code).toBe("INSUFFICIENT_STOCK");
    expect(error.message).toContain('"Product A"');
    expect(error.message).toContain("requested 4, available 3");
    expect(error.fields).toHaveProperty("items.0.quantity");
  });

  it("validates line items: at least one line, positive quantity, no duplicate products", async () => {
    const a = await product("A", 100, 3);
    const empty = await create({ customerName: "Acme Ltd", items: [] });
    const zero = await create({ customerName: "Acme Ltd", items: [{ productId: a, quantity: 0 }] });
    const dup = await create({
      customerName: "Acme Ltd",
      items: [
        { productId: a, quantity: 1 },
        { productId: a, quantity: 1 },
      ],
    });
    expect([empty.status, zero.status, dup.status]).toEqual([422, 422, 422]);
    expect((await dup.json()).error.fields).toHaveProperty("items.1.productId");
  });

  it("(d) issuing decrements stock for every line", async () => {
    const a = await product("A", 100, 10);
    const b = await product("B", 200, 5);
    const inv = await draft([
      { productId: a, quantity: 4 },
      { productId: b, quantity: 5 },
    ]);
    expect(await stockOf(a)).toBe(10); // a draft does not reserve stock

    const res = await action(issue, inv.id);
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe("ISSUED");
    expect(await stockOf(a)).toBe(6);
    expect(await stockOf(b)).toBe(0);
  });

  it("(e) cancelling an issued invoice restores its stock; cancelling a draft restores nothing", async () => {
    const a = await product("A", 100, 10);
    const issued = await draft([{ productId: a, quantity: 4 }]);
    await action(issue, issued.id);
    expect(await stockOf(a)).toBe(6);

    const res = await action(cancel, issued.id);
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe("CANCELLED");
    expect(await stockOf(a)).toBe(10);

    const drafted = await draft([{ productId: a, quantity: 2 }]);
    await action(cancel, drafted.id);
    expect(await stockOf(a)).toBe(10);
  });

  it("issuing is all-or-nothing: one short line leaves every product untouched", async () => {
    const a = await product("A", 100, 5);
    const b = await product("B", 100, 5);
    const inv = await draft([
      { productId: a, quantity: 2 },
      { productId: b, quantity: 4 },
    ]);
    // Stock of B drops after the draft was created (e.g. a manual stock correction).
    await patchProduct(makeRequest("PATCH", `/api/products/${b}`, { cookie, body: { quantityOnHand: 1 } }), idCtx(b));

    const res = await action(issue, inv.id);
    expect(res.status).toBe(409);
    expect((await res.json()).error.message).toContain('"Product B"');
    expect(await stockOf(a)).toBe(5); // A's decrement was rolled back
    expect(await stockOf(b)).toBe(1);
    const after = await getInvoice(makeRequest("GET", `/api/invoices/${inv.id}`, { cookie }), idCtx(inv.id));
    expect((await after.json()).data.status).toBe("DRAFT");
  });

  it("concurrent issues of invoices competing for the same stock never oversell", async () => {
    const a = await product("A", 100, 5);
    const first = await draft([{ productId: a, quantity: 3 }]);
    const second = await draft([{ productId: a, quantity: 3 }]);

    const results = await Promise.all([action(issue, first.id), action(issue, second.id)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await stockOf(a)).toBe(2);
  });

  it("issuing the same invoice twice at once only decrements stock once", async () => {
    const a = await product("A", 100, 10);
    const inv = await draft([{ productId: a, quantity: 3 }]);
    const results = await Promise.all([action(issue, inv.id), action(issue, inv.id)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await stockOf(a)).toBe(7);
  });

  it("enforces the status machine and rejects illegal transitions", async () => {
    const a = await product("A", 100, 10);
    const inv = await draft([{ productId: a, quantity: 1 }]);

    const payDraft = await action(pay, inv.id);
    expect(payDraft.status).toBe(409);
    expect((await payDraft.json()).error.code).toBe("INVALID_TRANSITION");

    expect((await action(issue, inv.id)).status).toBe(200);
    expect((await action(issue, inv.id)).status).toBe(409); // ISSUED → ISSUED
    expect((await action(pay, inv.id)).status).toBe(200);

    // PAID is terminal.
    expect((await action(cancel, inv.id)).status).toBe(409);
    expect((await action(issue, inv.id)).status).toBe(409);
    expect(await stockOf(a)).toBe(9);

    // CANCELLED is terminal too.
    const other = await draft([{ productId: a, quantity: 1 }]);
    await action(cancel, other.id);
    expect((await action(issue, other.id)).status).toBe(409);
  });

  it("changing a product's price later does not change an existing invoice", async () => {
    const a = await product("A", 1000, 10);
    const inv = await draft([{ productId: a, quantity: 2 }]);
    await patchProduct(
      makeRequest("PATCH", `/api/products/${a}`, { cookie, body: { unitPrice: 9999, name: "Renamed" } }),
      idCtx(a),
    );

    const res = await getInvoice(makeRequest("GET", `/api/invoices/${inv.id}`, { cookie }), idCtx(inv.id));
    const { data } = await res.json();
    expect(data.items[0]).toMatchObject({ productName: "Product A", unitPrice: 1000, lineTotal: 2000 });
    expect(data.total).toBe(inv.total);
  });

  it("only lets DRAFT invoices be edited", async () => {
    const a = await product("A", 1000, 10);
    const b = await product("B", 500, 10);
    const inv = await draft([{ productId: a, quantity: 1 }]);

    const edited = await patchInvoice(
      makeRequest("PATCH", `/api/invoices/${inv.id}`, {
        cookie,
        body: { items: [{ productId: a, quantity: 2 }, { productId: b, quantity: 1 }] },
      }),
      idCtx(inv.id),
    );
    expect(edited.status).toBe(200);
    expect((await edited.json()).data.subtotal).toBe(2500);

    await action(issue, inv.id);
    const locked = await patchInvoice(
      makeRequest("PATCH", `/api/invoices/${inv.id}`, { cookie, body: { items: [{ productId: a, quantity: 1 }] } }),
      idCtx(inv.id),
    );
    expect(locked.status).toBe(409);
    expect((await locked.json()).error.code).toBe("INVOICE_NOT_EDITABLE");
  });

  it("blocks deleting a product that an invoice references", async () => {
    const a = await product("A", 100, 10);
    await draft([{ productId: a, quantity: 1 }]);
    const res = await deleteProduct(makeRequest("DELETE", `/api/products/${a}`, { cookie }), idCtx(a));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("PRODUCT_IN_USE");
  });

  it("lists invoices with a status filter and pagination, scoped to the user", async () => {
    const a = await product("A", 100, 10);
    const one = await draft([{ productId: a, quantity: 1 }]);
    await draft([{ productId: a, quantity: 1 }]);
    await action(issue, one.id);

    const issued = await (await listInvoices(makeRequest("GET", "/api/invoices?status=ISSUED", { cookie }), undefined)).json();
    expect(issued.total).toBe(1);
    expect(issued.data[0]).toMatchObject({ id: one.id, status: "ISSUED" });

    const all = await (await listInvoices(makeRequest("GET", "/api/invoices?pageSize=1", { cookie }), undefined)).json();
    expect(all).toMatchObject({ total: 2, totalPages: 2, pageSize: 1 });

    const bad = await listInvoices(makeRequest("GET", "/api/invoices?status=BOGUS", { cookie }), undefined);
    expect(bad.status).toBe(422);

    const stranger = await signUp();
    const theirs = await listInvoices(makeRequest("GET", "/api/invoices", { cookie: stranger.cookie }), undefined);
    expect((await theirs.json()).total).toBe(0);
    const peek = await getInvoice(makeRequest("GET", `/api/invoices/${one.id}`, { cookie: stranger.cookie }), idCtx(one.id));
    expect(peek.status).toBe(404);
  });

  it("requires authentication on invoice endpoints", async () => {
    const id = "000000000000000000000000";
    const statuses = await Promise.all([
      listInvoices(makeRequest("GET", "/api/invoices"), undefined),
      createInvoice(makeRequest("POST", "/api/invoices", { body: {} }), undefined),
      getInvoice(makeRequest("GET", `/api/invoices/${id}`), idCtx(id)),
      patchInvoice(makeRequest("PATCH", `/api/invoices/${id}`, { body: {} }), idCtx(id)),
      issue(makeRequest("POST", `/api/invoices/${id}/issue`), idCtx(id)),
      pay(makeRequest("POST", `/api/invoices/${id}/pay`), idCtx(id)),
      cancel(makeRequest("POST", `/api/invoices/${id}/cancel`), idCtx(id)),
    ]).then((rs) => rs.map((r) => r.status));
    expect(statuses).toEqual([401, 401, 401, 401, 401, 401, 401]);
  });
});
