import { NextResponse } from "next/server";
import { authedHandler, parseBody, type IdContext } from "@/server/http";
import { invoiceUpdateSchema } from "@/server/invoices/invoice.schemas";
import { getInvoice, updateInvoice } from "@/server/invoices/invoice.service";

export const GET = authedHandler<IdContext>(async (_req, ctx, user) => {
  const { id } = await ctx.params;
  return NextResponse.json({ data: await getInvoice(user.id, id) });
});

export const PATCH = authedHandler<IdContext>(async (req, ctx, user) => {
  const { id } = await ctx.params;
  return NextResponse.json({ data: await updateInvoice(user.id, id, await parseBody(req, invoiceUpdateSchema)) });
});
