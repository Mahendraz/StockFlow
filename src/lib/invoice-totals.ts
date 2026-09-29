import { multiply, sum, taxFor } from "./money";

export interface PricedLine {
  unitPrice: number; // minor units
  quantity: number;
}

export interface InvoiceTotals {
  lineTotals: number[];
  subtotal: number;
  taxAmount: number;
  total: number;
}

/**
 * The one place invoice arithmetic happens. The server stores its result; the
 * browser uses the same function only to preview totals while the form is filled in.
 * Tax is computed once on the subtotal (not per line), rounded half-up.
 */
export function computeTotals(lines: PricedLine[], taxRateBps: number): InvoiceTotals {
  const lineTotals = lines.map((l) => multiply(l.unitPrice, l.quantity));
  const subtotal = sum(lineTotals);
  const taxAmount = taxFor(subtotal, taxRateBps);
  return { lineTotals, subtotal, taxAmount, total: sum([subtotal, taxAmount]) };
}
