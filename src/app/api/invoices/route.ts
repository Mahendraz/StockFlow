// /api/invoices: list and create invoices. Handlers stay thin: auth + input parsing here, rules in invoice.service.ts.

import { NextResponse } from "next/server";
import { authedHandler, parseBody, parseQuery } from "@/server/http";
import { invoiceCreateSchema, invoiceListQuerySchema } from "@/server/invoices/invoice.schemas";
import { createInvoice, listInvoices } from "@/server/invoices/invoice.service";

// GET /api/invoices: the user's invoices, newest first, optional ?status= filter, paginated (without line items).
export const GET = authedHandler(async (req, _ctx, user) => {
  return NextResponse.json(await listInvoices(user.id, parseQuery(req, invoiceListQuerySchema)));
});

// POST /api/invoices: creates a DRAFT invoice (201). Stock is checked (409 if short) but only deducted on issue.
export const POST = authedHandler(async (req, _ctx, user) => {
  const invoice = await createInvoice(user.id, await parseBody(req, invoiceCreateSchema));
  return NextResponse.json({ data: invoice }, { status: 201 });
});
