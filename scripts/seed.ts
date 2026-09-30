/**
 * Seeds a demo account with products and two invoices. Safe to re-run: it resets
 * only the demo user's data. Uses the real services, so the issued invoice
 * decrements stock exactly as it would through the app.
 *
 *   npm run db:seed   →   demo@stockflow.test / Demo12345!
 */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDb } from "@/server/db";
import { env } from "@/server/env";
import { changeStatus, createInvoice } from "@/server/invoices/invoice.service";
import { Counter } from "@/server/models/counter";
import { Invoice } from "@/server/models/invoice";
import { Product } from "@/server/models/product";
import { Session } from "@/server/models/session";
import { User } from "@/server/models/user";
import { createProduct } from "@/server/products/product.service";

/** The demo login this script creates; the README lists the same credentials. */
export const DEMO_EMAIL = "demo@stockflow.test";
export const DEMO_PASSWORD = "Demo12345!";

// Prices in minor units (1/100): 85000000 = 850,000.00
const PRODUCTS = [
  { sku: "KB-001", name: "Mechanical keyboard", unitPrice: 85_000_000, quantityOnHand: 25 },
  { sku: "MS-002", name: "Wireless mouse", unitPrice: 25_000_000, quantityOnHand: 40 },
  { sku: "MN-024", name: '24" monitor', unitPrice: 215_000_000, quantityOnHand: 12, description: "IPS, 1080p" },
  { sku: "CB-USBC", name: "USB-C cable 1m", unitPrice: 4_500_000, quantityOnHand: 150 },
  { sku: "SSD-500", name: "500GB SSD", unitPrice: 72_500_000, quantityOnHand: 18 },
  { sku: "LS-STD", name: "Laptop stand", unitPrice: 32_000_000, quantityOnHand: 3 },
  { sku: "WC-HD", name: "HD webcam", unitPrice: 48_000_000, quantityOnHand: 0 },
  { sku: "HS-BT", name: "Bluetooth headset", unitPrice: 61_000_000, quantityOnHand: 9 },
];

/** Wipes the old demo user, creates a fresh one, then adds products and invoices through the real services. */
async function main() {
  try {
    process.loadEnvFile(); // .env, if present; otherwise rely on real environment variables
  } catch {}

  await connectDb();

  // Re-run: remove the previous demo user and everything they own, so the seed always starts clean.
  const existing = await User.findOne({ email: DEMO_EMAIL });
  if (existing) {
    const userId = existing._id;
    await Promise.all([
      Product.deleteMany({ userId }),
      Invoice.deleteMany({ userId }),
      Counter.deleteMany({ userId }),
      Session.deleteMany({ userId }),
      User.deleteOne({ _id: userId }),
    ]);
  }

  const user = await User.create({
    email: DEMO_EMAIL,
    passwordHash: await bcrypt.hash(DEMO_PASSWORD, env().BCRYPT_COST),
  });

  // SKU → product id, used below to build the invoice lines.
  const products = new Map<string, string>();
  for (const p of PRODUCTS) products.set(p.sku, (await createProduct(user._id, p)).id);

  // First invoice is issued, so its stock is really deducted; the second one stays a DRAFT.
  const issued = await createInvoice(user._id, {
    customerName: "PT Maju Jaya",
    notes: "Net 30. Thank you for your business.",
    items: [
      { productId: products.get("KB-001")!, quantity: 2 },
      { productId: products.get("MS-002")!, quantity: 5 },
    ],
  });
  await changeStatus(user._id, issued.id, "ISSUED");

  await createInvoice(user._id, {
    customerName: "CV Sinar Abadi",
    items: [
      { productId: products.get("MN-024")!, quantity: 1 },
      { productId: products.get("CB-USBC")!, quantity: 10 },
    ],
  });

  console.log(`Seeded ${PRODUCTS.length} products and 2 invoices (1 issued, 1 draft).`);
  console.log(`Log in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

// Always close the DB connection at the end; an open connection would keep the script from exiting.
main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
