import { InvoiceDetail } from "@/components/InvoiceDetail";

/** Route /invoices/[id]: one invoice. Passes the URL id to InvoiceDetail, which loads the data in the browser. */
export default async function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  const { id } = await params;
  return <InvoiceDetail id={id} />;
}
