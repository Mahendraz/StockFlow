import { NextResponse } from "next/server";
import { authedHandler, parseBody, parseQuery } from "@/server/http";
import { productInputSchema, productListQuerySchema } from "@/server/products/product.schemas";
import { createProduct, listProducts } from "@/server/products/product.service";

export const GET = authedHandler(async (req, _ctx, user) => {
  return NextResponse.json(await listProducts(user.id, parseQuery(req, productListQuerySchema)));
});

export const POST = authedHandler(async (req, _ctx, user) => {
  const product = await createProduct(user.id, await parseBody(req, productInputSchema));
  return NextResponse.json({ data: product }, { status: 201 });
});
