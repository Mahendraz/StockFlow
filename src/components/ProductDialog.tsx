"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, errorMessage, fieldErrors, type FieldErrors } from "@/lib/api-client";
import type { ProductDTO } from "@/lib/api-types";
import { formatMinor, parseMajorInput } from "@/lib/money";
import { ErrorBanner, Field } from "./ui";

/** Create (product = null) or edit a product. Prices are typed in major units, sent as minor units. */
export function ProductDialog({ product, onClose }: { product: ProductDTO | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  // Form values as text. When editing, the price is shown in major units without thousands separators.
  const [form, setForm] = useState({
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    description: product?.description ?? "",
    unitPrice: product ? formatMinor(product.unitPrice).replace(/,/g, "") : "",
    quantityOnHand: product ? String(product.quantityOnHand) : "",
  });
  // Errors found in the browser before sending (only numbers that fail to parse).
  const [localErrors, setLocalErrors] = useState<FieldErrors>({});

  // Save: PATCH /api/products/:id when editing, POST /api/products when creating; then refresh lists and close.
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      product
        ? api(`/api/products/${product.id}`, { method: "PATCH", body })
        : api("/api/products", { method: "POST", body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      onClose();
    },
  });

  /** Converts price and quantity to numbers; if either fails, shows the error here, otherwise saves. */
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const unitPrice = parseMajorInput(form.unitPrice);
    const quantity = /^\d+$/.test(form.quantityOnHand.trim()) ? Number(form.quantityOnHand) : null;
    // Only parsing problems are caught here; every business rule is validated by the server.
    const errors: FieldErrors = {};
    if (unitPrice === null) errors.unitPrice = ["Enter an amount like 12500 or 12500.50"];
    if (quantity === null) errors.quantityOnHand = ["Enter a whole number, 0 or more"];
    setLocalErrors(errors);
    if (Object.keys(errors).length > 0) return;

    save.mutate({
      sku: form.sku,
      name: form.name,
      description: form.description, // always sent: an empty string is how an edit clears it
      unitPrice,
      quantityOnHand: quantity,
    });
  }

  // Server errors and local parsing errors together; a local error wins for the same field.
  const errors = { ...fieldErrors(save.error), ...localErrors };
  // Shared props for each input: id, value, change handler, and a red border when the field has an error.
  const bind = (key: keyof typeof form) => ({
    id: key,
    className: "input",
    value: form[key],
    "aria-invalid": !!errors[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value }),
  });

  // Modal: a dark overlay with the form card on top of the page.
  return (
    <div className="fixed inset-0 z-10 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:pt-20">
      <form role="dialog" aria-modal="true" aria-labelledby="product-dialog-title" onSubmit={onSubmit} className="card w-full max-w-md space-y-3" noValidate>
        <h2 id="product-dialog-title" className="text-lg font-semibold">
          {product ? `Edit ${product.name}` : "New product"}
        </h2>
        {save.error && <ErrorBanner message={errorMessage(save.error)} />}
        <Field label="SKU" htmlFor="sku" errors={errors.sku}>
          <input {...bind("sku")} autoFocus />
        </Field>
        <Field label="Name" htmlFor="name" errors={errors.name}>
          <input {...bind("name")} />
        </Field>
        <Field label="Description (optional)" htmlFor="description" errors={errors.description}>
          <textarea {...bind("description")} rows={2} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Unit price" htmlFor="unitPrice" errors={errors.unitPrice}>
            <input {...bind("unitPrice")} inputMode="decimal" placeholder="0.00" />
          </Field>
          <Field label="Quantity on hand" htmlFor="quantityOnHand" errors={errors.quantityOnHand}>
            <input {...bind("quantityOnHand")} inputMode="numeric" placeholder="0" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
