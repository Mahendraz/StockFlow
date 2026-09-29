import type { Types } from "mongoose";
import { conflict, notFound } from "../errors";
import { Invoice } from "../models/invoice";
import { Product, type ProductFields } from "../models/product";
import { escapeRegex, parseObjectId, toPage, type Page } from "../validation";
import type { ProductInput, ProductListQuery, ProductUpdate } from "./product.schemas";

export interface ProductDTO {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unitPrice: number;
  quantityOnHand: number;
  createdAt: string;
  updatedAt: string;
}

type ProductRecord = ProductFields & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

export function toProductDTO(p: ProductRecord): ProductDTO {
  return {
    id: p._id.toString(),
    sku: p.sku,
    name: p.name,
    description: p.description ?? null,
    unitPrice: p.unitPrice,
    quantityOnHand: p.quantityOnHand,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

// Every query below filters by userId: a user can never read or touch another user's products.

export async function listProducts(userId: Types.ObjectId, query: ProductListQuery): Promise<Page<ProductDTO>> {
  const filter: Record<string, unknown> = { userId };
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ name: pattern }, { sku: pattern }];
  }
  const [rows, total] = await Promise.all([
    Product.find(filter)
      .sort({ name: 1, _id: 1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean<ProductRecord[]>(),
    Product.countDocuments(filter),
  ]);
  return toPage(rows.map(toProductDTO), total, query);
}

export async function getProduct(userId: Types.ObjectId, id: string): Promise<ProductDTO> {
  const product = await Product.findOne({ _id: parseObjectId(id, "Product"), userId }).lean<ProductRecord>();
  if (!product) throw notFound("Product");
  return toProductDTO(product);
}

export async function createProduct(userId: Types.ObjectId, input: ProductInput): Promise<ProductDTO> {
  const product = await Product.create({ ...input, userId });
  return toProductDTO(product.toObject() as ProductRecord);
}

/**
 * Updating a product never touches existing invoices: their lines hold their own
 * snapshot of name and price. `quantityOnHand` is set to the given absolute value.
 */
export async function updateProduct(userId: Types.ObjectId, id: string, input: ProductUpdate): Promise<ProductDTO> {
  const product = await Product.findOneAndUpdate(
    { _id: parseObjectId(id, "Product"), userId },
    { $set: input },
    { returnDocument: "after", runValidators: true },
  ).lean<ProductRecord>();
  if (!product) throw notFound("Product");
  return toProductDTO(product);
}

/**
 * Hard delete, blocked with 409 while any invoice line references the product,
 * so invoice history never points at a product that silently disappeared.
 */
export async function deleteProduct(userId: Types.ObjectId, id: string): Promise<void> {
  const productId = parseObjectId(id, "Product");
  const usedBy = await Invoice.countDocuments({ userId, "items.productId": productId });
  if (usedBy > 0) {
    throw conflict(
      "PRODUCT_IN_USE",
      `This product is used by ${usedBy} invoice${usedBy === 1 ? "" : "s"} and cannot be deleted`,
    );
  }
  const result = await Product.deleteOne({ _id: productId, userId });
  if (result.deletedCount === 0) throw notFound("Product");
}
