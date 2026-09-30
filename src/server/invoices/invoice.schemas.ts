// Zod schemas for invoice API input: create, update, and the list filters.

import { z } from "zod";
import { INVOICE_STATUSES } from "@/lib/invoice-status";
import { paginationSchema } from "../validation";

/**
 * True for a real calendar date. "2026-02-30" parses but rolls over to March, so the
 * round trip fails. "2026-13-01" parses to an Invalid Date, whose toISOString() would
 * throw (a 500), so that is checked first.
 */
function isCalendarDate(s: string): boolean {
  const date = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(s);
}

/** "YYYY-MM-DD" that is also a real calendar date. */
const dateOnly = z
  .string()
  // abort: a string in the wrong format gets one message and never reaches the date check.
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Use the format YYYY-MM-DD", abort: true })
  .refine(isCalendarDate, "Not a valid date");

/** One requested line: which product and how many. Name and price come from the product, never the client. */
const lineSchema = z.object({
  productId: z.string().regex(/^[a-f\d]{24}$/i, "Choose a product"),
  quantity: z
    .number({ error: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .max(1_000_000, "Quantity is too large"),
});

/** 1 to 100 lines, and each product may appear only once. */
const itemsSchema = z
  .array(lineSchema)
  .min(1, "Add at least one line item")
  .max(100, "An invoice can have at most 100 lines")
  .superRefine((items, ctx) => {
    const seen = new Set<string>();
    items.forEach((item, i) => {
      const key = item.productId.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", path: [i, "productId"], message: "This product is already on the invoice" });
      }
      seen.add(key);
    });
  });

/** Fields shared by the create and update schemas. */
const fields = {
  customerName: z.string().trim().min(1, "Customer name is required").max(200),
  issueDate: dateOnly.optional(),
  dueDate: dateOnly.optional(),
  notes: z.string().trim().max(2000).optional(),
  items: itemsSchema,
};

// Totals are deliberately NOT part of the input: anything the client sends for
// subtotal/tax/total/lineTotal/unitPrice is stripped here and recomputed by the server.
export const invoiceCreateSchema = z.object(fields);

/** PATCH body: any subset of the create fields, but at least one. */
export const invoiceUpdateSchema = z
  .object(fields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");

/** GET /api/invoices query: pagination plus an optional status filter. */
export const invoiceListQuerySchema = paginationSchema.extend({
  status: z.enum(INVOICE_STATUSES).optional(),
});

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>;
export type InvoiceLineInput = z.infer<typeof lineSchema>;
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;
