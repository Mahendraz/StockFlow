"use client";

// Small UI pieces shared by the screens: error banner, form field, pagination, status badge, table message.

import type { InvoiceStatus } from "@/lib/invoice-status";

/** Red alert box with a message, plus a Retry button when `onRetry` is given. */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

/** Label + control + the server's field-level messages for it. */
export function Field({
  label,
  htmlFor,
  errors,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  errors?: string[];
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !errors?.length && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <FieldErrorText errors={errors} />
    </div>
  );
}

/** A field's error messages in red; renders nothing when there are none. */
export function FieldErrorText({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 text-xs text-red-700">{errors.join(" ")}</p>;
}

/** "N total" with Prev/Next buttons; Prev is disabled on the first page, Next on the last. */
export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
      <span>{total} total</span>
      <div className="flex items-center gap-2">
        <button type="button" className="btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          ‹ Prev
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button type="button" className="btn" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Next ›
        </button>
      </div>
    </div>
  );
}

// Badge colours for each invoice status.
const statusStyles: Record<InvoiceStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ISSUED: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-700",
};

/** Small coloured label showing an invoice status. */
export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusStyles[status]}`}>{status}</span>;
}

/** A full-width table row used for loading / empty messages inside a table body. */
export function TableMessage({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-8 text-center text-slate-500">
        {children}
      </td>
    </tr>
  );
}
