"use client";

import { useActionState } from "react";
import { TextField, SelectField, TextAreaField } from "@/components/form-field";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "./actions";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
];

const PROVIDER_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "square", label: "Square" },
  { value: "shopify", label: "Shopify" },
  { value: "manual", label: "Manual (cash/check/other)" },
];

export type MembershipDefaults = {
  id?: string;
  customer_id: string | null;
  plan_id: string | null;
  status: string;
  start_date: string | null;
  renewal_date: string | null;
  payment_provider: string | null;
  external_payment_id: string | null;
  notes: string | null;
};

export function MembershipForm({
  action,
  defaults,
  submitLabel,
  customerOptions,
  planOptions,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: MembershipDefaults;
  submitLabel: string;
  customerOptions: { value: string; label: string }[];
  planOptions: { value: string; label: string }[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          label="Customer"
          name="customer_id"
          defaultValue={defaults.customer_id ?? ""}
          options={
            customerOptions.length > 0 ? customerOptions : [{ value: "", label: "No customers yet" }]
          }
        />
        <SelectField
          label="Plan"
          name="plan_id"
          defaultValue={defaults.plan_id ?? ""}
          options={planOptions.length > 0 ? planOptions : [{ value: "", label: "No plans yet" }]}
        />
        <SelectField label="Status" name="status" defaultValue={defaults.status} options={STATUS_OPTIONS} />
        <TextField label="Start date" name="start_date" type="date" defaultValue={defaults.start_date} />
        <TextField label="Renewal date" name="renewal_date" type="date" defaultValue={defaults.renewal_date} />
        <SelectField
          label="Payment provider"
          name="payment_provider"
          defaultValue={defaults.payment_provider ?? ""}
          options={PROVIDER_OPTIONS}
        />
        <TextField
          label="External payment ID"
          name="external_payment_id"
          defaultValue={defaults.external_payment_id}
          placeholder="Optional"
        />
      </div>

      <TextAreaField label="Notes" name="notes" defaultValue={defaults.notes} rows={3} />

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
