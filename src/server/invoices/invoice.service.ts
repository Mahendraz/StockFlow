// Invoice business rules: create and edit drafts, change status, and move stock when that happens.

import { Types, type ClientSession } from "mongoose";
import { canTransition, type InvoiceStatus } from "@/lib/invoice-status";
import { computeTotals } from "@/lib/invoice-totals";
import { withTransaction } from "../db";
import { env } from "../env";
import { conflict, notFound, validationError, type FieldErrors } from "../errors";
import { Counter } from "../models/counter";
import { Invoice, type InvoiceFields } from "../models/invoice";
import { Product } from "../models/product";
import { parseObjectId, toPage, type Page } from "../validation";
import type { InvoiceCreateInput, InvoiceLineInput, InvoiceListQuery, InvoiceUpdateInput } from "./invoice.schemas";

/** Used when no due date is given: due date = issue date + 30 days. */
const DEFAULT_PAYMENT_TERM_DAYS = 30;

/** One line as the API returns it: a snapshot of the product taken when the line was added. */
export interface InvoiceItemDTO {
  productId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

/** An invoice as the list shows it (no lines). Dates are "YYYY-MM-DD", money is in minor units. */
export interface InvoiceSummaryDTO {
  id: string;
  invoiceNumber: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  total: number;
  createdAt: string;
}

/** A full invoice as the API returns it: summary fields plus notes, lines and totals. */
export interface InvoiceDTO extends InvoiceSummaryDTO {
  notes: string | null;
  items: InvoiceItemDTO[];
  subtotal: number;
  taxRateBps: number;
  taxAmount: number;
  updatedAt: string;
}

type InvoiceItem = InvoiceFields["items"][number];
type InvoiceRecord = InvoiceFields & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

// ---------------------------------------------------------------- dates (stored as UTC midnight)

/** Date → "YYYY-MM-DD" (UTC). */
const toDateOnly = (d: Date) => d.toISOString().slice(0, 10);
/** "YYYY-MM-DD" → Date at UTC midnight. */
const fromDateOnly = (s: string) => new Date(`${s}T00:00:00Z`);
/** Today's date at UTC midnight. */
const todayUtc = () => fromDateOnly(toDateOnly(new Date()));
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);

/** Throws 422 when the due date is before the issue date. */
function assertDueAfterIssue(issueDate: Date, dueDate: Date) {
  if (dueDate < issueDate) throw validationError({ dueDate: ["Due date cannot be before the issue date"] });
}

// ---------------------------------------------------------------- mapping

/** Converts a stored invoice to the list shape (string id, "YYYY-MM-DD" issue and due dates). */
function toSummaryDTO(inv: InvoiceRecord): InvoiceSummaryDTO {
  return {
    id: inv._id.toString(),
    invoiceNumber: inv.invoiceNumber,
    customerName: inv.customerName,
    issueDate: toDateOnly(inv.issueDate),
    dueDate: toDateOnly(inv.dueDate),
    status: inv.status as InvoiceStatus,
    total: inv.total,
    createdAt: inv.createdAt.toISOString(),
  };
}

/** Converts a stored invoice to the full API shape, lines and totals included. */
function toInvoiceDTO(inv: InvoiceRecord): InvoiceDTO {
  return {
    ...toSummaryDTO(inv),
    notes: inv.notes ?? null,
    items: inv.items.map((i) => ({
      productId: i.productId.toString(),
      productName: i.productName,
      sku: i.sku,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
    subtotal: inv.subtotal,
    taxRateBps: inv.taxRateBps,
    taxAmount: inv.taxAmount,
    updatedAt: inv.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------- line building

/**
 * Turns requested lines into snapshot lines: resolves each product (must belong to
 * the user), copies its name/SKU/price onto the line, and checks the quantity
 * against stock on hand. Lines for products already on the invoice keep their
 * original snapshot, so a price captured once is never silently changed.
 */
async function buildItems(
  userId: Types.ObjectId,
  lines: InvoiceLineInput[],
  existing: InvoiceItem[],
  session: ClientSession,
): Promise<InvoiceItem[]> {
  const ids = lines.map((l) => new Types.ObjectId(l.productId));
  const products = await Product.find({ _id: { $in: ids }, userId }).session(session).lean();
  const productById = new Map(products.map((p) => [p._id.toString(), p]));
  const snapshotById = new Map(existing.map((i) => [i.productId.toString(), i]));

  // Collect problems before throwing, so one error lists every missing product (422) or every short line (409).
  const missing: FieldErrors = {};
  const shortages: string[] = [];
  const shortageFields: FieldErrors = {};

  const items = lines.map((line, i) => {
    // Map keys are lower-case ObjectId strings; the client may send upper-case hex.
    const product = productById.get(line.productId.toLowerCase());
    if (!product) {
      missing[`items.${i}.productId`] = ["Product not found"];
      return null;
    }
    if (line.quantity > product.quantityOnHand) {
      const msg = `Insufficient stock for "${product.name}" (SKU ${product.sku}): requested ${line.quantity}, available ${product.quantityOnHand}`;
      shortages.push(msg);
      shortageFields[`items.${i}.quantity`] = [msg];
    }
    const snapshot = snapshotById.get(product._id.toString());
    return {
      productId: product._id,
      productName: snapshot?.productName ?? product.name,
      sku: snapshot?.sku ?? product.sku,
      unitPrice: snapshot?.unitPrice ?? product.unitPrice,
      quantity: line.quantity,
      lineTotal: 0, // filled in by applyTotals
    };
  });

  if (Object.keys(missing).length > 0) throw validationError(missing, "Some products could not be found");
  if (shortages.length > 0) throw conflict("INSUFFICIENT_STOCK", shortages.join("; "), shortageFields);
  return items as InvoiceItem[];
}

/** Server-side totals; nothing the client sent is used here. */
function applyTotals(items: InvoiceItem[], taxRateBps: number) {
  const totals = computeTotals(items, taxRateBps);
  items.forEach((item, i) => (item.lineTotal = totals.lineTotals[i]));
  return { items, subtotal: totals.subtotal, taxRateBps, taxAmount: totals.taxAmount, total: totals.total };
}

/** INV-2026-0001, numbered per user per year via an atomic counter. */
async function nextInvoiceNumber(userId: Types.ObjectId, session: ClientSession): Promise<string> {
  const year = new Date().getUTCFullYear();
  // $inc is atomic; upsert creates the counter on the user's first invoice of the year.
  const counter = await Counter.findOneAndUpdate(
    { userId, year },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", session },
  ).lean();
  return `INV-${year}-${String(counter!.seq).padStart(4, "0")}`;
}

// ---------------------------------------------------------------- queries

/** Lists the user's invoices, newest first, with an optional status filter and pagination. */
export async function listInvoices(userId: Types.ObjectId, query: InvoiceListQuery): Promise<Page<InvoiceSummaryDTO>> {
  const filter: Record<string, unknown> = { userId };
  if (query.status) filter.status = query.status;
  const [rows, total] = await Promise.all([
    Invoice.find(filter)
      // The list does not need line items.
      .select("-items")
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean<InvoiceRecord[]>(),
    Invoice.countDocuments(filter),
  ]);
  return toPage(rows.map(toSummaryDTO), total, query);
}

/** Returns one of the user's invoices. Another user's id, or a malformed id, is 404. */
export async function getInvoice(userId: Types.ObjectId, id: string): Promise<InvoiceDTO> {
  const invoice = await Invoice.findOne({ _id: parseObjectId(id, "Invoice"), userId }).lean<InvoiceRecord>();
  if (!invoice) throw notFound("Invoice");
  return toInvoiceDTO(invoice);
}

// ---------------------------------------------------------------- commands

/** Creates a DRAFT invoice. Stock is checked here but only consumed when the invoice is issued. */
export async function createInvoice(userId: Types.ObjectId, input: InvoiceCreateInput): Promise<InvoiceDTO> {
  const issueDate = input.issueDate ? fromDateOnly(input.issueDate) : todayUtc();
  const dueDate = input.dueDate ? fromDateOnly(input.dueDate) : addDays(issueDate, DEFAULT_PAYMENT_TERM_DAYS);
  assertDueAfterIssue(issueDate, dueDate);

  // One transaction: if saving fails, the invoice number taken from the counter is rolled back too.
  return withTransaction(async (session) => {
    const items = await buildItems(userId, input.items, [], session);
    const [invoice] = await Invoice.create(
      [
        {
          userId,
          invoiceNumber: await nextInvoiceNumber(userId, session),
          customerName: input.customerName,
          issueDate,
          dueDate,
          status: "DRAFT",
          notes: input.notes,
          ...applyTotals(items, env().taxRateBps),
        },
      ],
      { session },
    );
    return toInvoiceDTO(invoice.toObject() as InvoiceRecord);
  });
}

/** Edits a DRAFT invoice. Any other status is rejected with 409 (V9). */
export async function updateInvoice(userId: Types.ObjectId, id: string, input: InvoiceUpdateInput): Promise<InvoiceDTO> {
  const invoiceId = parseObjectId(id, "Invoice");
  return withTransaction(async (session) => {
    const invoice = await Invoice.findOne({ _id: invoiceId, userId }).session(session);
    if (!invoice) throw notFound("Invoice");
    if (invoice.status !== "DRAFT") {
      throw conflict("INVOICE_NOT_EDITABLE", `Only draft invoices can be edited; this invoice is ${invoice.status}`);
    }

    if (input.customerName !== undefined) invoice.customerName = input.customerName;
    if (input.notes !== undefined) invoice.notes = input.notes;
    if (input.issueDate !== undefined) invoice.issueDate = fromDateOnly(input.issueDate);
    if (input.dueDate !== undefined) invoice.dueDate = fromDateOnly(input.dueDate);
    assertDueAfterIssue(invoice.issueDate, invoice.dueDate);

    if (input.items !== undefined) {
      // Pass the current lines, so products already on the invoice keep their snapshot price.
      const existing = invoice.toObject().items as InvoiceItem[];
      const items = await buildItems(userId, input.items, existing, session);
      invoice.set(applyTotals(items, env().taxRateBps));
    }

    await invoice.save({ session });
    return toInvoiceDTO(invoice.toObject() as InvoiceRecord);
  });
}

/**
 * Moves an invoice to `target` status inside one transaction:
 *  - DRAFT → ISSUED       decrements stock for every line (all lines or none)
 *  - ISSUED → CANCELLED   gives that stock back
 *  - DRAFT → CANCELLED, ISSUED → PAID   touch no stock
 * Anything not in ALLOWED_TRANSITIONS is rejected with 409.
 */
export async function changeStatus(userId: Types.ObjectId, id: string, target: InvoiceStatus): Promise<InvoiceDTO> {
  const invoiceId = parseObjectId(id, "Invoice");
  return withTransaction(async (session) => {
    const invoice = await Invoice.findOne({ _id: invoiceId, userId }).session(session).lean<InvoiceRecord>();
    if (!invoice) throw notFound("Invoice");
    const from = invoice.status as InvoiceStatus;
    if (!canTransition(from, target)) {
      throw conflict("INVALID_TRANSITION", `Cannot change an invoice from ${from} to ${target}`);
    }

    // Conditional on the status we just read: if a concurrent request already moved it,
    // this matches nothing and we refuse instead of applying the stock change twice.
    const updated = await Invoice.findOneAndUpdate(
      { _id: invoiceId, userId, status: from },
      { $set: { status: target } },
      { returnDocument: "after", session },
    ).lean<InvoiceRecord>();
    if (!updated) throw conflict("INVALID_TRANSITION", "The invoice status changed meanwhile; reload and try again");

    if (target === "ISSUED") await consumeStock(userId, invoice.items, session);
    if (target === "CANCELLED" && from === "ISSUED") await restoreStock(userId, invoice.items, session);

    return toInvoiceDTO(updated);
  });
}

/**
 * Decrements stock line by line. Each update only matches while enough stock is left
 * (`quantityOnHand >= quantity`), so stock can never go negative, even under concurrent
 * issues. The first line that cannot be covered throws, which aborts the transaction
 * and undoes the lines already decremented.
 */
async function consumeStock(userId: Types.ObjectId, items: InvoiceItem[], session: ClientSession) {
  for (const item of items) {
    const result = await Product.updateOne(
      { _id: item.productId, userId, quantityOnHand: { $gte: item.quantity } },
      { $inc: { quantityOnHand: -item.quantity } },
      { session },
    );
    // No match = not enough stock left. Read the current amount only to build the error message.
    if (result.matchedCount === 0) {
      const product = await Product.findOne({ _id: item.productId, userId }).session(session).lean();
      throw conflict(
        "INSUFFICIENT_STOCK",
        `Insufficient stock for "${item.productName}" (SKU ${item.sku}): requested ${item.quantity}, available ${product?.quantityOnHand ?? 0}`,
      );
    }
  }
}

/** Adds each line's quantity back to its product. Used when an ISSUED invoice is cancelled. */
async function restoreStock(userId: Types.ObjectId, items: InvoiceItem[], session: ClientSession) {
  for (const item of items) {
    // Products referenced by invoices cannot be deleted, so the product is always there.
    await Product.updateOne({ _id: item.productId, userId }, { $inc: { quantityOnHand: item.quantity } }, { session });
  }
}
