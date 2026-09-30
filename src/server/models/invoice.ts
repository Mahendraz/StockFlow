// Mongoose model for invoices, with line items embedded in the invoice document.

import { Schema, model, models, type HydratedDocument, type InferSchemaType, type Model } from "mongoose";
import { INVOICE_STATUSES } from "@/lib/invoice-status";

/** A required, non-negative amount in minor units. */
const money = { type: Number, required: true, min: 0 };

// Line items are embedded: they are snapshots that belong to one invoice and are
// always read and written together with it.
const invoiceItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    // Snapshots taken when the line was added. Later product edits never change them.
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    unitPrice: money,
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: money,
  },
  { _id: false },
);

/** Stores its own totals and tax rate, so later product-price or TAX_RATE changes don't alter a saved invoice. */
const invoiceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    invoiceNumber: { type: String, required: true },
    customerName: { type: String, required: true, trim: true },
    issueDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: INVOICE_STATUSES, required: true, default: "DRAFT" },
    notes: { type: String, trim: true },
    items: { type: [invoiceItemSchema], required: true },
    subtotal: money,
    taxRateBps: { type: Number, required: true },
    taxAmount: money,
    total: money,
  },
  { timestamps: true },
);

// Invoice numbers are unique per user.
invoiceSchema.index({ userId: 1, invoiceNumber: 1 }, { unique: true });
// For the invoice list: filter by status, newest first.
invoiceSchema.index({ userId: 1, status: 1, createdAt: -1 });
// Supports the "is this product used by any invoice?" check before deleting a product.
invoiceSchema.index({ userId: 1, "items.productId": 1 });

export type InvoiceFields = InferSchemaType<typeof invoiceSchema>;
export type InvoiceDocument = HydratedDocument<InvoiceFields>;

export const Invoice = (models.Invoice as Model<InvoiceFields>) || model("Invoice", invoiceSchema);
