"use client";

import Link from "next/link";
import { errorMessage } from "@/lib/api-client";
import { InvoiceForm } from "./InvoiceForm";
import { ErrorBanner } from "./ui";
import { useInvoice } from "./use-invoice";

/** Edit screen: loads the invoice, then shows InvoiceForm for a DRAFT, or a message for any other status. */
export function EditInvoice({ id, taxRateBps }: { id: string; taxRateBps: number }) {
  const invoice = useInvoice(id);

  if (invoice.isPending) return <p className="text-slate-500">Loading invoice…</p>;
  if (invoice.error) return <ErrorBanner message={errorMessage(invoice.error)} onRetry={() => invoice.refetch()} />;

  // The server rejects edits to non-drafts anyway (409); this just explains it up front.
  if (invoice.data.status !== "DRAFT") {
    return (
      <div className="space-y-3">
        <ErrorBanner message={`Only draft invoices can be edited. This one is ${invoice.data.status.toLowerCase()}.`} />
        <Link href={`/invoices/${id}`} className="btn">
          ← Back to invoice
        </Link>
      </div>
    );
  }

  return <InvoiceForm taxRateBps={taxRateBps} invoice={invoice.data} />;
}
