"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { InvoiceDTO } from "@/lib/api-types";

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api<{ data: InvoiceDTO }>(`/api/invoices/${id}`).then((r) => r.data),
  });
}
