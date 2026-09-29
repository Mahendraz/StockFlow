import { z } from "zod";
import { INVOICE_STATUSES } from "@/lib/invoice-status";
import { paginationSchema } from "../validation";

/** "YYYY-MM-DD" that is also a real calendar date (rejects 2026-02-30). */
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine((s) => new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), "Not a valid date");

const lineSchema = z.object({
  productId: z.string().regex(/^[a-f\d]{24}$/i, "Choose a product"),
  quantity: z
    .number({ error: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .max(1_000_000, "Quantity is too large"),
});

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

export const invoiceUpdateSchema = z
  .object(fields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");

export const invoiceListQuerySchema = paginationSchema.extend({
  status: z.enum(INVOICE_STATUSES).optional(),
});

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>;
export type InvoiceLineInput = z.infer<typeof lineSchema>;
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;
