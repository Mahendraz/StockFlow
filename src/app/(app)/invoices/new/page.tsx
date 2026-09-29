import { InvoiceForm } from "@/components/InvoiceForm";
import { env } from "@/server/env";

// Server component: reads the configured tax rate so the form's preview matches the server.
export default function NewInvoicePage() {
  return <InvoiceForm taxRateBps={env().taxRateBps} />;
}
