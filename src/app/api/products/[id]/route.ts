import { NextResponse } from "next/server";
import { authedHandler, parseBody, type IdContext } from "@/server/http";
import { productUpdateSchema } from "@/server/products/product.schemas";
import { deleteProduct, getProduct, updateProduct } from "@/server/products/product.service";

export const GET = authedHandler<IdContext>(async (_req, ctx, user) => {
  const { id } = await ctx.params;
  return NextResponse.json({ data: await getProduct(user.id, id) });
});

export const PATCH = authedHandler<IdContext>(async (req, ctx, user) => {
  const { id } = await ctx.params;
  return NextResponse.json({ data: await updateProduct(user.id, id, await parseBody(req, productUpdateSchema)) });
});

export const DELETE = authedHandler<IdContext>(async (_req, ctx, user) => {
  const { id } = await ctx.params;
  await deleteProduct(user.id, id);
  return new NextResponse(null, { status: 204 });
});
