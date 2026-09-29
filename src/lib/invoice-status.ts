/**
 * Invoice lifecycle. The single source of truth for which status changes are legal,
 * used by the server to enforce transitions and by the UI to decide which buttons to show.
 *
 *   DRAFT ──issue──▶ ISSUED ──pay──▶ PAID
 *     │                │
 *     └──cancel──▶ CANCELLED ◀──cancel
 */
export const INVOICE_STATUSES = ["DRAFT", "ISSUED", "PAID", "CANCELLED"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const ALLOWED_TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  DRAFT: ["ISSUED", "CANCELLED"],
  ISSUED: ["PAID", "CANCELLED"],
  PAID: [],
  CANCELLED: [],
};

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
