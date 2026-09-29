import { InvoiceDetail } from "@/components/InvoiceDetail";

export default async function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  const { id } = await params;
  return <InvoiceDetail id={id} />;
}
