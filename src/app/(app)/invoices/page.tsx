"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBanner, Pagination, StatusBadge, TableMessage } from "@/components/ui";
import { api, errorMessage } from "@/lib/api-client";
import type { InvoiceSummaryDTO, Page } from "@/lib/api-types";
import { INVOICE_STATUSES, type InvoiceStatus } from "@/lib/invoice-status";
import { formatMinor } from "@/lib/money";

const PAGE_SIZE = 10;

/** Route /invoices: the user's invoices, newest first, with a status filter and pagination (GET /api/invoices). */
export default function InvoicesPage() {
  const router = useRouter();
  // Status filter ("" = all) and current page. Changing the filter jumps back to page 1.
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [page, setPage] = useState(1);

  // One cached request per filter + page. keepPreviousData keeps the old rows (dimmed) while the next page loads.
  const invoices = useQuery({
    queryKey: ["invoices", { status, page }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (status) params.set("status", status);
      return api<Page<InvoiceSummaryDTO>>(`/api/invoices?${params}`);
    },
    placeholderData: keepPreviousData,
  });

  const rows = invoices.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <Link href="/invoices/new" className="btn btn-primary">
          + New invoice
        </Link>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="status" className="text-sm text-slate-600">
          Status
        </label>
        <select
          id="status"
          className="input w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as InvoiceStatus | "");
            setPage(1);
          }}
        >
          <option value="">All</option>
          {INVOICE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      {invoices.error && <ErrorBanner message={errorMessage(invoices.error)} onRetry={() => invoices.refetch()} />}

      {/* Invoice table: clicking a row opens that invoice */}
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Customer</th>
              <th>Issue date</th>
              <th>Due date</th>
              <th>Status</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoices.isPending && <TableMessage colSpan={6}>Loading invoices…</TableMessage>}
            {invoices.isSuccess && rows.length === 0 && (
              <TableMessage colSpan={6}>
                {status ? `No ${status.toLowerCase()} invoices.` : "No invoices yet. Create your first one."}
              </TableMessage>
            )}
            {rows.map((inv) => (
              <tr
                key={inv.id}
                className={`cursor-pointer hover:bg-slate-50 ${invoices.isPlaceholderData ? "opacity-60" : ""}`}
                onClick={() => router.push(`/invoices/${inv.id}`)}
              >
                <td className="font-mono text-xs">
                  <Link href={`/invoices/${inv.id}`} className="text-blue-700 hover:underline">
                    {inv.invoiceNumber}
                  </Link>
                </td>
                <td>{inv.customerName}</td>
                <td className="whitespace-nowrap">{inv.issueDate}</td>
                <td className="whitespace-nowrap">{inv.dueDate}</td>
                <td>
                  <StatusBadge status={inv.status} />
                </td>
                <td className="num">{formatMinor(inv.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invoices.data && (
        <Pagination page={invoices.data.page} totalPages={invoices.data.totalPages} total={invoices.data.total} onChange={setPage} />
      )}
    </div>
  );
}
