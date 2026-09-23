"use client";

import { useActionState } from "react";
import { TextField, SelectField, TextAreaField } from "@/components/form-field";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "./actions";

export type LeadDefaults = {
  id?: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  source: string | null;
  assigned_staff: string | null;
  service_interest: string | null;
  notes: string | null;
};

export function LeadForm({
  action,
  defaults,
  submitLabel,
  statusOptions,
  staffOptions,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: LeadDefaults;
  submitLabel: string;
  statusOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label="First name" name="first_name" defaultValue={defaults.first_name} />
        <TextField label="Last name" name="last_name" defaultValue={defaults.last_name} />
        <TextField label="Email" name="email" type="email" defaultValue={defaults.email} />
        <TextField label="Phone" name="phone" type="tel" defaultValue={defaults.phone} />
        <SelectField label="Status" name="status" defaultValue={defaults.status} options={statusOptions} />
        <TextField label="Source" name="source" defaultValue={defaults.source} placeholder="How they found us" />
        <TextField label="Service interest" name="service_interest" defaultValue={defaults.service_interest} />
        {staffOptions.length > 0 ? (
          <SelectField
            label="Assigned to"
            name="assigned_staff"
            defaultValue={defaults.assigned_staff ?? ""}
            options={[{ value: "", label: "Unassigned" }, ...staffOptions]}
          />
        ) : null}
      </div>

      <TextAreaField label="Notes" name="notes" defaultValue={defaults.notes} rows={4} />

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
