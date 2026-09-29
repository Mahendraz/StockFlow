import { EditInvoice } from "@/components/EditInvoice";
import { env } from "@/server/env";

export default async function EditInvoicePage({ params }: PageProps<"/invoices/[id]/edit">) {
  const { id } = await params;
  return <EditInvoice id={id} taxRateBps={env().taxRateBps} />;
}
