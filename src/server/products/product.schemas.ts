// Zod schemas for product API input: create, update, and list/search.

import { z } from "zod";
import { paginationSchema } from "../validation";

/** A whole number from 0 to MAX_SAFE_INTEGER. Used for the price (minor units) and the stock count. */
const minorAmount = (label: string) =>
  z
    .number({ error: `${label} must be a number` })
    .int(`${label} must be a whole number of minor units`)
    .min(0, `${label} must be 0 or more`)
    .max(Number.MAX_SAFE_INTEGER, `${label} is too large`);

/** POST /api/products body. The PATCH schema below is built from it. */
export const productInputSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(64, "SKU must be at most 64 characters"),
  name: z.string().trim().min(1, "Name is required").max(200, "Name must be at most 200 characters"),
  description: z.string().trim().max(2000, "Description must be at most 2000 characters").optional(),
  unitPrice: minorAmount("Unit price"),
  quantityOnHand: minorAmount("Quantity on hand"),
});

// PATCH: any subset of fields, but at least one.
export const productUpdateSchema = productInputSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");

/** GET /api/products query: pagination plus an optional search text q (matches name or SKU). */
export const productListQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductUpdate = z.infer<typeof productUpdateSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
