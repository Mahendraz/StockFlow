import { NextResponse } from "next/server";
import { authedHandler, parseBody, parseQuery } from "@/server/http";
import { invoiceCreateSchema, invoiceListQuerySchema } from "@/server/invoices/invoice.schemas";
import { createInvoice, listInvoices } from "@/server/invoices/invoice.service";

export const GET = authedHandler(async (req, _ctx, user) => {
  return NextResponse.json(await listInvoices(user.id, parseQuery(req, invoiceListQuerySchema)));
});

export const POST = authedHandler(async (req, _ctx, user) => {
  const invoice = await createInvoice(user.id, await parseBody(req, invoiceCreateSchema));
  return NextResponse.json({ data: invoice }, { status: 201 });
});
