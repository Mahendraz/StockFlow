// /api/products: list and create products. Handlers stay thin: auth + input parsing here, rules in product.service.ts.

import { NextResponse } from "next/server";
import { authedHandler, parseBody, parseQuery } from "@/server/http";
import { productInputSchema, productListQuerySchema } from "@/server/products/product.schemas";
import { createProduct, listProducts } from "@/server/products/product.service";

// GET /api/products: the user's products sorted by name, optional ?q= search on name or SKU, paginated.
export const GET = authedHandler(async (req, _ctx, user) => {
  return NextResponse.json(await listProducts(user.id, parseQuery(req, productListQuerySchema)));
});

// POST /api/products: creates a product (201); 409 if this user already has a product with that SKU.
export const POST = authedHandler(async (req, _ctx, user) => {
  const product = await createProduct(user.id, await parseBody(req, productInputSchema));
  return NextResponse.json({ data: product }, { status: 201 });
});
