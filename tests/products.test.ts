import { beforeEach, describe, expect, it } from "vitest";
import { DELETE, GET as getOne, PATCH } from "@/app/api/products/[id]/route";
import { GET as list, POST as create } from "@/app/api/products/route";
import { idCtx, makeRequest, signUp } from "./helpers";

let cookie: string;

async function createProduct(body: Record<string, unknown>, as = cookie) {
  return create(makeRequest("POST", "/api/products", { body, cookie: as }), undefined);
}

const widget = { sku: "wid-1", name: "Widget", unitPrice: 150000, quantityOnHand: 10 };

describe("products", () => {
  beforeEach(async () => {
    ({ cookie } = await signUp());
  });

  it("creates, reads, updates and deletes a product", async () => {
    const created = await createProduct(widget);
    expect(created.status).toBe(201);
    const { data } = await created.json();
    expect(data).toMatchObject({ sku: "WID-1", name: "Widget", unitPrice: 150000, quantityOnHand: 10 });

    const fetched = await getOne(makeRequest("GET", `/api/products/${data.id}`, { cookie }), idCtx(data.id));
    expect((await fetched.json()).data.name).toBe("Widget");

    const updated = await PATCH(
      makeRequest("PATCH", `/api/products/${data.id}`, { cookie, body: { unitPrice: 175000 } }),
      idCtx(data.id),
    );
    expect((await updated.json()).data.unitPrice).toBe(175000);

    const deleted = await DELETE(makeRequest("DELETE", `/api/products/${data.id}`, { cookie }), idCtx(data.id));
    expect(deleted.status).toBe(204);
    const gone = await getOne(makeRequest("GET", `/api/products/${data.id}`, { cookie }), idCtx(data.id));
    expect(gone.status).toBe(404);
  });

  it("clears a description when it is updated to an empty string", async () => {
    const { data } = await (await createProduct({ ...widget, description: "Blue, 10 cm" })).json();
    expect(data.description).toBe("Blue, 10 cm");

    const res = await PATCH(
      makeRequest("PATCH", `/api/products/${data.id}`, { cookie, body: { description: "" } }),
      idCtx(data.id),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.description).toBeNull();
  });

  it("returns field-level 422 errors for invalid input", async () => {
    const res = await createProduct({ sku: "", name: "X", unitPrice: -1, quantityOnHand: 1.5 });
    expect(res.status).toBe(422);
    const { error } = await res.json();
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(error.fields).sort()).toEqual(["quantityOnHand", "sku", "unitPrice"]);
  });

  it("rejects a duplicate SKU for the same user with 409 (case-insensitive)", async () => {
    await createProduct(widget);
    const dup = await createProduct({ ...widget, sku: "WID-1", name: "Other" });
    expect(dup.status).toBe(409);
    expect((await dup.json()).error.fields).toHaveProperty("sku");
  });

  it("allows the same SKU for different users", async () => {
    await createProduct(widget);
    const other = await signUp();
    expect((await createProduct(widget, other.cookie)).status).toBe(201);
  });

  it("searches by name or SKU and paginates", async () => {
    for (let i = 1; i <= 5; i++) {
      await createProduct({ sku: `BOLT-${i}`, name: `Bolt ${i}`, unitPrice: 100, quantityOnHand: 1 });
    }
    await createProduct({ sku: "NUT-1", name: "Hex nut", unitPrice: 50, quantityOnHand: 1 });

    const page2 = await (await list(makeRequest("GET", "/api/products?q=bolt&page=2&pageSize=2", { cookie }), undefined)).json();
    expect(page2).toMatchObject({ page: 2, pageSize: 2, total: 5, totalPages: 3 });
    expect(page2.data.map((p: { name: string }) => p.name)).toEqual(["Bolt 3", "Bolt 4"]);

    const bySku = await (await list(makeRequest("GET", "/api/products?q=nut-", { cookie }), undefined)).json();
    expect(bySku.data.map((p: { sku: string }) => p.sku)).toEqual(["NUT-1"]);

    // Regex metacharacters in the search box are treated literally.
    const weird = await list(makeRequest("GET", "/api/products?q=.*", { cookie }), undefined);
    expect((await weird.json()).total).toBe(0);
  });

  it("does not let one user see or modify another user's product", async () => {
    const { data } = await (await createProduct(widget)).json();
    const intruder = await signUp();

    const read = await getOne(makeRequest("GET", `/api/products/${data.id}`, { cookie: intruder.cookie }), idCtx(data.id));
    const edit = await PATCH(
      makeRequest("PATCH", `/api/products/${data.id}`, { cookie: intruder.cookie, body: { quantityOnHand: 0 } }),
      idCtx(data.id),
    );
    const listed = await (await list(makeRequest("GET", "/api/products", { cookie: intruder.cookie }), undefined)).json();

    expect(read.status).toBe(404);
    expect(edit.status).toBe(404);
    expect(listed.total).toBe(0);
  });

  it("requires authentication on every product endpoint", async () => {
    const id = "000000000000000000000000";
    const responses = await Promise.all([
      list(makeRequest("GET", "/api/products"), undefined),
      create(makeRequest("POST", "/api/products", { body: widget }), undefined),
      getOne(makeRequest("GET", `/api/products/${id}`), idCtx(id)),
      PATCH(makeRequest("PATCH", `/api/products/${id}`, { body: { name: "x" } }), idCtx(id)),
      DELETE(makeRequest("DELETE", `/api/products/${id}`), idCtx(id)),
    ]);
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);
  });
});
