"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api, ApiError, errorMessage } from "@/lib/api-client";
import type { InvoiceDTO } from "@/lib/api-types";
import { ALLOWED_TRANSITIONS, type InvoiceStatus } from "@/lib/invoice-status";
import { formatMinor, formatRateBps } from "@/lib/money";
import { ErrorBanner, StatusBadge } from "./ui";
import { useInvoice } from "./use-invoice";

/** One button per target status; which ones show comes from ALLOWED_TRANSITIONS. */
const ACTIONS: Record<Exclude<InvoiceStatus, "DRAFT">, { path: string; label: string; className: string }> = {
  ISSUED: { path: "issue", label: "Issue", className: "btn btn-primary" },
  PAID: { path: "pay", label: "Mark paid", className: "btn btn-primary" },
  CANCELLED: { path: "cancel", label: "Cancel invoice", className: "btn btn-danger" },
};

function confirmText(from: InvoiceStatus, to: InvoiceStatus): string | null {
  if (to === "ISSUED") return "Issue this invoice? Stock will be deducted for every line.";
  if (to === "CANCELLED") {
    return from === "ISSUED" ? "Cancel this invoice? Its stock will be returned." : "Cancel this draft invoice?";
  }
  return null;
}

export function InvoiceDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const invoice = useInvoice(id);

  const transition = useMutation({
    mutationFn: (path: string) => api<{ data: InvoiceDTO }>(`/api/invoices/${id}/${path}`, { method: "POST" }),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(["invoice", id], data);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["products"] }); // stock changed
    },
  });

  if (invoice.isPending) return <p className="text-slate-500">Loading invoice…</p>;
  if (invoice.error) {
    if (invoice.error instanceof ApiError && invoice.error.status === 404) {
      return (
        <div className="space-y-3">
          <ErrorBanner message="Invoice not found." />
          <Link href="/invoices" className="btn">
            ← Back to invoices
          </Link>
        </div>
      );
    }
    return <ErrorBanner message={errorMessage(invoice.error)} onRetry={() => invoice.refetch()} />;
  }

  const inv = invoice.data;
  const targets = ALLOWED_TRANSITIONS[inv.status] as Exclude<InvoiceStatus, "DRAFT">[];

  function run(to: Exclude<InvoiceStatus, "DRAFT">) {
    const text = confirmText(inv.status, to);
    if (text && !confirm(text)) return;
    transition.mutate(ACTIONS[to].path);
  }

  return (
    <div className="space-y-4">
      <Link href="/invoices" className="text-sm text-blue-700 hover:underline">
        ← Invoices
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-semibold">{inv.invoiceNumber}</h1>
        <StatusBadge status={inv.status} />
        <div className="ml-auto flex flex-wrap gap-2">
          {inv.status === "DRAFT" && (
            <Link href={`/invoices/${inv.id}/edit`} className="btn">
              Edit
            </Link>
          )}
          {targets.map((to) => (
            <button key={to} type="button" className={ACTIONS[to].className} disabled={transition.isPending} onClick={() => run(to)}>
              {transition.isPending && transition.variables === ACTIONS[to].path ? "Working…" : ACTIONS[to].label}
            </button>
          ))}
        </div>
      </div>

      {transition.error && <ErrorBanner message={errorMessage(transition.error)} />}

      <dl className="card grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-slate-500">Customer</dt>
          <dd className="font-medium">{inv.customerName}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Issue date</dt>
          <dd>{inv.issueDate}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Due date</dt>
          <dd>{inv.dueDate}</dd>
        </div>
        {inv.notes && (
          <div className="sm:col-span-3">
            <dt className="text-slate-500">Notes</dt>
            <dd className="whitespace-pre-line">{inv.notes}</dd>
          </div>
        )}
      </dl>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th className="num">Unit price</th>
              <th className="num">Qty</th>
              <th className="num">Line total</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((item) => (
              <tr key={item.productId}>
                <td>{item.productName}</td>
                <td className="font-mono text-xs">{item.sku}</td>
                <td className="num">{formatMinor(item.unitPrice)}</td>
                <td className="num">{item.quantity}</td>
                <td className="num">{formatMinor(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto w-full max-w-xs space-y-1 p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">Subtotal</dt>
            <dd className="num">{formatMinor(inv.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">Tax ({formatRateBps(inv.taxRateBps)})</dt>
            <dd className="num">{formatMinor(inv.taxAmount)}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
            <dt>Total</dt>
            <dd className="num">{formatMinor(inv.total)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
