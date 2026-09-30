// /api/products/:id: read, update and delete one product, always scoped to the signed-in user.

import { NextResponse } from "next/server";
import { authedHandler, parseBody, type IdContext } from "@/server/http";
import { productUpdateSchema } from "@/server/products/product.schemas";
import { deleteProduct, getProduct, updateProduct } from "@/server/products/product.service";

// GET /api/products/:id: one product; 404 if it doesn't exist or belongs to another user.
export const GET = authedHandler<IdContext>(async (_req, ctx, user) => {
  const { id } = await ctx.params;
  return NextResponse.json({ data: await getProduct(user.id, id) });
});

// PATCH /api/products/:id: updates any subset of fields. Existing invoices keep their snapshot name and price.
export const PATCH = authedHandler<IdContext>(async (req, ctx, user) => {
  const { id } = await ctx.params;
  return NextResponse.json({ data: await updateProduct(user.id, id, await parseBody(req, productUpdateSchema)) });
});

// DELETE /api/products/:id: deletes the product (204); 409 PRODUCT_IN_USE if any invoice uses it.
export const DELETE = authedHandler<IdContext>(async (_req, ctx, user) => {
  const { id } = await ctx.params;
  await deleteProduct(user.id, id);
  return new NextResponse(null, { status: 204 });
});
