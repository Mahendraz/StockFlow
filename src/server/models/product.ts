// Mongoose model for products. Each belongs to one user and holds its current stock (quantityOnHand).

import { Schema, model, models, type HydratedDocument, type InferSchemaType, type Model } from "mongoose";

/** A required whole number ≥ 0 that fits safely in a JS number. */
const nonNegativeInt = {
  type: Number,
  required: true,
  min: 0,
  validate: { validator: Number.isSafeInteger, message: "{PATH} must be an integer" },
};

const productSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Stored upper-cased so "abc-1" and "ABC-1" count as the same SKU.
    sku: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    // Integer minor units (see src/lib/money.ts).
    unitPrice: nonNegativeInt,
    quantityOnHand: nonNegativeInt,
  },
  { timestamps: true },
);

// SKU is unique per user (each user is their own workspace), not globally.
productSchema.index({ userId: 1, sku: 1 }, { unique: true });
// For the product list, which is sorted by name.
productSchema.index({ userId: 1, name: 1 });

export type ProductFields = InferSchemaType<typeof productSchema>;
export type ProductDocument = HydratedDocument<ProductFields>;

export const Product = (models.Product as Model<ProductFields>) || model("Product", productSchema);
