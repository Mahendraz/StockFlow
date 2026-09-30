// /api/invoices/:id: read and edit one invoice. Status changes live in the issue/pay/cancel sub-routes.

import { NextResponse } from "next/server";
import { authedHandler, parseBody, type IdContext } from "@/server/http";
import { invoiceUpdateSchema } from "@/server/invoices/invoice.schemas";
import { getInvoice, updateInvoice } from "@/server/invoices/invoice.service";

// GET /api/invoices/:id: one invoice with its line items; 404 if it doesn't exist or belongs to another user.
export const GET = authedHandler<IdContext>(async (_req, ctx, user) => {
  const { id } = await ctx.params;
  return NextResponse.json({ data: await getInvoice(user.id, id) });
});

// PATCH /api/invoices/:id: edits a DRAFT invoice (totals recomputed when lines change); other statuses → 409.
export const PATCH = authedHandler<IdContext>(async (req, ctx, user) => {
  const { id } = await ctx.params;
  return NextResponse.json({ data: await updateInvoice(user.id, id, await parseBody(req, invoiceUpdateSchema)) });
});
