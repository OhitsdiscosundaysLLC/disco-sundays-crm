"use client";

import { useActionState } from "react";
import { TextField, SelectField, CheckboxField } from "@/components/form-field";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "./actions";

const BILLING_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
  { value: "one_time", label: "One-time" },
];

export type PlanDefaults = {
  id?: string;
  name: string;
  price: number | null;
  billing_interval: string;
  active: boolean;
};

export function PlanForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: PlanDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction} className="max-w-lg space-y-6">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <TextField label="Plan name" name="name" defaultValue={defaults.name} required />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Price (USD)"
          name="price"
          type="number"
          defaultValue={defaults.price !== null ? String(defaults.price) : null}
        />
        <SelectField
          label="Billing interval"
          name="billing_interval"
          defaultValue={defaults.billing_interval}
          options={BILLING_OPTIONS}
        />
      </div>
      <CheckboxField label="Active (available to assign)" name="active" defaultChecked={defaults.active} />

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
