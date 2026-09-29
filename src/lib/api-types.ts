// Response shapes shared with the browser. Type-only re-exports: no server code reaches the client bundle.
export type { PublicUser } from "@/server/auth/auth.service";
export type { InvoiceDTO, InvoiceItemDTO, InvoiceSummaryDTO } from "@/server/invoices/invoice.service";
export type { ProductDTO } from "@/server/products/product.service";
export type { Page } from "@/server/validation";
