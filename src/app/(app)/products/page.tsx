"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ProductDialog } from "@/components/ProductDialog";
import { ErrorBanner, Pagination, TableMessage } from "@/components/ui";
import { api, errorMessage } from "@/lib/api-client";
import type { Page, ProductDTO } from "@/lib/api-types";
import { formatMinor } from "@/lib/money";
import { useDebounced } from "@/lib/use-debounced";

const PAGE_SIZE = 10;

/**
 * Route /products: product list with search and pagination (GET /api/products).
 * "New product" and "Edit" open ProductDialog; "Delete" calls DELETE /api/products/:id.
 */
export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  // Dialog state: a product to edit, "new" to create one, or null when the dialog is closed.
  const [editing, setEditing] = useState<ProductDTO | "new" | null>(null);
  // The search text only reaches the API after typing pauses for 300 ms.
  const q = useDebounced(search.trim());

  // One cached request per search + page. keepPreviousData keeps the old rows (dimmed) while the next page loads.
  const products = useQuery({
    queryKey: ["products", { q, page }],
    queryFn: () =>
      api<Page<ProductDTO>>(`/api/products?${new URLSearchParams({ q, page: String(page), pageSize: String(PAGE_SIZE) })}`),
    placeholderData: keepPreviousData,
  });

  // Delete, then refresh every product list. The server refuses with 409 if an invoice uses the product.
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/products/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  /** Asks for confirmation before deleting. */
  function onDelete(p: ProductDTO) {
    if (confirm(`Delete "${p.name}" (${p.sku})? This cannot be undone.`)) remove.mutate(p.id);
  }

  const rows = products.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
          + New product
        </button>
      </div>

      {/* Search box: a new search starts again at page 1 */}
      <input
        type="search"
        className="input max-w-sm"
        placeholder="Search name or SKU"
        aria-label="Search products"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      {remove.error && <ErrorBanner message={errorMessage(remove.error)} />}
      {products.error && <ErrorBanner message={errorMessage(products.error)} onRetry={() => products.refetch()} />}

      {/* Product table: a stock of 0 is shown in red */}
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th className="num">Unit price</th>
              <th className="num">On hand</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {products.isPending && <TableMessage colSpan={5}>Loading products…</TableMessage>}
            {products.isSuccess && rows.length === 0 && (
              <TableMessage colSpan={5}>
                {q ? `No products match "${q}".` : "No products yet. Create your first one."}
              </TableMessage>
            )}
            {rows.map((p) => (
              <tr key={p.id} className={products.isPlaceholderData ? "opacity-60" : undefined}>
                <td className="font-mono text-xs">{p.sku}</td>
                <td>
                  {p.name}
                  {p.description && <div className="text-xs text-slate-500">{p.description}</div>}
                </td>
                <td className="num">{formatMinor(p.unitPrice)}</td>
                <td className={`num ${p.quantityOnHand === 0 ? "text-red-700" : ""}`}>{p.quantityOnHand}</td>
                <td className="text-right whitespace-nowrap">
                  <button type="button" className="btn mr-2" onClick={() => setEditing(p)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => onDelete(p)}
                    disabled={remove.isPending && remove.variables === p.id}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {products.data && (
        <Pagination page={products.data.page} totalPages={products.data.totalPages} total={products.data.total} onChange={setPage} />
      )}

      {/* Create/edit dialog, open while `editing` is set */}
      {editing && <ProductDialog product={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
