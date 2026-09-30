"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { InvoiceDTO } from "@/lib/api-types";

/** Loads one invoice (GET /api/invoices/:id), cached under ["invoice", id]. Used by the detail and edit screens. */
export function useInvoice(id: string) {
  return useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api<{ data: InvoiceDTO }>(`/api/invoices/${id}`).then((r) => r.data),
  });
}
