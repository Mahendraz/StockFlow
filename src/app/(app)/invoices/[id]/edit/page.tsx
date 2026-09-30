import { EditInvoice } from "@/components/EditInvoice";
import { env } from "@/server/env";

/** Route /invoices/[id]/edit: edit a DRAFT invoice. Passes the server's tax rate so the preview matches. */
export default async function EditInvoicePage({ params }: PageProps<"/invoices/[id]/edit">) {
  const { id } = await params;
  return <EditInvoice id={id} taxRateBps={env().taxRateBps} />;
}
