"use client";

import { useActionState } from "react";
import type { Product } from "@/lib/products";
import { ui } from "@/lib/ui";
import type { FormState } from "./actions";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

function Field(props: {
  name: string;
  label: string;
  help?: string;
  defaultValue?: string | number;
  type?: string;
  step?: string;
  suffix?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const { name, label, help, suffix, ...input } = props;
  return (
    <div>
      <label htmlFor={name} className={ui.label}>
        {label}
        {suffix && <span className="font-normal text-ink-soft"> ({suffix})</span>}
      </label>
      <input id={name} name={name} className={ui.input} {...input} />
      {help && <p className="mt-1 text-sm text-ink-soft">{help}</p>}
    </div>
  );
}

export function ProductForm({ action, product }: { action: Action; product?: Product }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const dollars = (cents: number | null | undefined) =>
    cents === null || cents === undefined ? "" : (cents / 100).toFixed(2);

  return (
    <form action={formAction} className="space-y-6">
      <Field name="name" label="Product name" defaultValue={product?.name} required placeholder="e.g. Earl Grey 20 bags" />

      <fieldset>
        <legend className={ui.label}>Box size</legend>
        <p className="mb-2 text-sm text-ink-soft">
          Measure the real box with a ruler, standing as it sits on the shelf. Cylinders come later.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="width_mm" label="Width" suffix="mm" type="number" step="0.5" defaultValue={product?.width_mm} required />
          <Field name="height_mm" label="Height" suffix="mm" type="number" step="0.5" defaultValue={product?.height_mm} required />
          <Field name="depth_mm" label="Depth" suffix="mm" type="number" step="0.5" defaultValue={product?.depth_mm} required />
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="brand_name" label="Brand name" defaultValue={product?.brand_name ?? ""} help="Shown on the front if you do not upload a logo." />
        <Field name="brand_colours" label="Brand colours" defaultValue={product?.brand_colours?.join(", ") ?? ""} placeholder="#1f6e7d, #a9834f" help="Optional hex codes, up to 5." />
      </div>

      <Field
        name="mandatory_text"
        label="Text that must always appear"
        defaultValue={product?.mandatory_text ?? ""}
        placeholder="e.g. 20 tea bags, net weight 40 g"
        help="Printed on the front and back of every design, exactly as written."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="base_price" label="Normal price" suffix="CAD" type="number" step="0.01" defaultValue={dollars(product?.base_price_cents)} required />
        <Field name="premium_price" label="Price with personalized packaging" suffix="CAD" type="number" step="0.01" defaultValue={dollars(product?.premium_price_cents)} required />
      </div>

      <label className="flex items-start gap-3">
        <input type="checkbox" name="allow_custom_content" defaultChecked={product?.allow_custom_content} className="mt-1 size-5" />
        <span>
          <span className="font-semibold">Let customers add their own short text</span>
          <span className="block text-sm text-ink-soft">For example a name, shown on the front of the box.</span>
        </span>
      </label>

      <div aria-live="polite">
        {state?.error && <p className={ui.error}>{state.error}</p>}
        {state?.message && <p className={ui.notice}>{state.message}</p>}
      </div>

      <button type="submit" disabled={pending} className={ui.button}>
        {pending ? "Saving…" : product ? "Save details" : "Create product"}
      </button>
    </form>
  );
}
