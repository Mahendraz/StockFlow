"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage, fieldErrors } from "@/lib/api-client";
import type { InvoiceDTO, Page, ProductDTO } from "@/lib/api-types";
import { computeTotals, type PricedLine } from "@/lib/invoice-totals";
import { formatMinor, formatRateBps, multiply } from "@/lib/money";
import { ErrorBanner, Field, FieldErrorText } from "./ui";

interface Line {
  key: number;
  productId: string;
  quantity: string;
}

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
const plusDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

let nextKey = 1;
const newLine = (productId = "", quantity = "1"): Line => ({ key: nextKey++, productId, quantity });

/**
 * Create a new invoice, or edit a DRAFT one (`invoice` given).
 * The totals shown here are a preview only; the server recalculates everything on save.
 */
export function InvoiceForm({ taxRateBps, invoice }: { taxRateBps: number; invoice?: InvoiceDTO }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const issue = invoice?.issueDate ?? today();
  const [form, setForm] = useState({
    customerName: invoice?.customerName ?? "",
    issueDate: issue,
    dueDate: invoice?.dueDate ?? plusDays(issue, 30),
    notes: invoice?.notes ?? "",
  });
  const [lines, setLines] = useState<Line[]>(() =>
    invoice ? invoice.items.map((i) => newLine(i.productId, String(i.quantity))) : [newLine()],
  );

  // The picker lists up to 100 products (a known limitation; see README).
  const products = useQuery({
    queryKey: ["products", "picker"],
    queryFn: () => api<Page<ProductDTO>>("/api/products?pageSize=100"),
  });
  const productById = new Map((products.data?.data ?? []).map((p) => [p.id, p]));
  // Lines already on a draft keep their snapshot price, exactly like the server does.
  const snapshotById = new Map((invoice?.items ?? []).map((i) => [i.productId, i]));

  const priceOf = (productId: string) => snapshotById.get(productId)?.unitPrice ?? productById.get(productId)?.unitPrice;
  const qtyOf = (line: Line) => (/^\d+$/.test(line.quantity) ? Number(line.quantity) : 0);
  const lineTotalOf = (unitPrice: number | undefined, qty: number) => {
    if (unitPrice === undefined) return null;
    try {
      return multiply(unitPrice, qty);
    } catch {
      return null;
    }
  };

  const priced: PricedLine[] = lines.flatMap((l) => {
    const unitPrice = priceOf(l.productId);
    return unitPrice === undefined ? [] : [{ unitPrice, quantity: qtyOf(l) }];
  });
  let preview: ReturnType<typeof computeTotals> | null = null;
  try {
    preview = computeTotals(priced, taxRateBps);
  } catch {
    preview = null; // absurdly large quantity; the server will reject it with a message
  }

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      invoice
        ? api<{ data: InvoiceDTO }>(`/api/invoices/${invoice.id}`, { method: "PATCH", body })
        : api<{ data: InvoiceDTO }>("/api/invoices", { method: "POST", body }),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(["invoice", data.id], data);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      router.push(`/invoices/${data.id}`);
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    save.mutate({
      ...form,
      items: lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity) })),
    });
  }

  const updateLine = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const errors = fieldErrors(save.error);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <h1 className="text-2xl font-semibold">{invoice ? `Edit ${invoice.invoiceNumber}` : "New invoice"}</h1>

      {save.error && <ErrorBanner message={errorMessage(save.error)} />}
      {products.error && <ErrorBanner message={errorMessage(products.error)} onRetry={() => products.refetch()} />}

      <div className="card grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <Field label="Customer name" htmlFor="customerName" errors={errors.customerName}>
            <input id="customerName" className="input" value={form.customerName} onChange={set("customerName")} aria-invalid={!!errors.customerName} />
          </Field>
        </div>
        <Field label="Issue date" htmlFor="issueDate" errors={errors.issueDate}>
          <input id="issueDate" type="date" className="input" value={form.issueDate} onChange={set("issueDate")} />
        </Field>
        <Field label="Due date" htmlFor="dueDate" errors={errors.dueDate}>
          <input id="dueDate" type="date" className="input" value={form.dueDate} onChange={set("dueDate")} />
        </Field>
        <div className="sm:col-span-3">
          <Field label="Notes (optional)" htmlFor="notes" errors={errors.notes}>
            <textarea id="notes" className="input" rows={2} value={form.notes} onChange={set("notes")} />
          </Field>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-medium">Line items</h2>
        <FieldErrorText errors={errors.items} />
        {products.isPending && <p className="text-sm text-slate-500">Loading products…</p>}
        {products.isSuccess && productById.size === 0 && (
          <p className="text-sm text-slate-600">
            You have no products yet.{" "}
            <Link href="/products" className="text-blue-700 hover:underline">
              Add some first
            </Link>
            .
          </p>
        )}

        {lines.map((line, i) => {
          const product = productById.get(line.productId);
          const unitPrice = priceOf(line.productId);
          const qty = qtyOf(line);
          const chosenElsewhere = new Set(lines.filter((l) => l.key !== line.key).map((l) => l.productId));
          return (
            <div key={line.key} className="grid grid-cols-2 items-start gap-2 border-b border-slate-100 pb-3 sm:grid-cols-[1fr_6rem_7rem_7rem_auto]">
              <div className="col-span-2 sm:col-span-1">
                <label className="label sm:sr-only" htmlFor={`product-${line.key}`}>
                  Product
                </label>
                <select
                  id={`product-${line.key}`}
                  className="input"
                  value={line.productId}
                  onChange={(e) => updateLine(line.key, { productId: e.target.value })}
                  aria-invalid={!!errors[`items.${i}.productId`]}
                >
                  <option value="">Choose a product…</option>
                  {(products.data?.data ?? []).map((p) => (
                    <option key={p.id} value={p.id} disabled={chosenElsewhere.has(p.id)}>
                      {p.sku} – {p.name} ({p.quantityOnHand} in stock)
                    </option>
                  ))}
                </select>
                <FieldErrorText errors={errors[`items.${i}.productId`]} />
              </div>
              <div>
                <label className="label sm:sr-only" htmlFor={`qty-${line.key}`}>
                  Quantity
                </label>
                <input
                  id={`qty-${line.key}`}
                  className="input text-right"
                  inputMode="numeric"
                  value={line.quantity}
                  onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                  aria-invalid={!!errors[`items.${i}.quantity`]}
                />
                {product && qty > product.quantityOnHand && !errors[`items.${i}.quantity`] && (
                  <p className="mt-1 text-xs text-amber-700">Only {product.quantityOnHand} in stock</p>
                )}
                <FieldErrorText errors={errors[`items.${i}.quantity`]} />
              </div>
              <div className="num pt-2 text-sm text-slate-600">{unitPrice === undefined ? "—" : formatMinor(unitPrice)}</div>
              <div className="num pt-2 text-sm font-medium">
                {(() => {
                  const total = lineTotalOf(unitPrice, qty);
                  return total === null ? "—" : formatMinor(total);
                })()}
              </div>
              <button
                type="button"
                className="btn justify-self-end"
                aria-label="Remove line"
                disabled={lines.length === 1}
                onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
              >
                ×
              </button>
            </div>
          );
        })}

        <button type="button" className="btn" onClick={() => setLines((ls) => [...ls, newLine()])}>
          + Add line
        </button>

        <dl className="ml-auto w-full max-w-xs space-y-1 pt-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">Subtotal</dt>
            <dd className="num">{preview ? formatMinor(preview.subtotal) : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">Tax ({formatRateBps(taxRateBps)})</dt>
            <dd className="num">{preview ? formatMinor(preview.taxAmount) : "—"}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
            <dt>Total</dt>
            <dd className="num">{preview ? formatMinor(preview.total) : "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="flex justify-end gap-2">
        <Link href={invoice ? `/invoices/${invoice.id}` : "/invoices"} className="btn">
          Cancel
        </Link>
        <button type="submit" className="btn btn-primary" disabled={save.isPending}>
          {save.isPending ? "Saving…" : invoice ? "Save changes" : "Save draft"}
        </button>
      </div>
    </form>
  );
}
