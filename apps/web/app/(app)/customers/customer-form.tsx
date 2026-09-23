"use client";

import { useActionState } from "react";
import { TextField, SelectField } from "@/components/form-field";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "./actions";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

export type CustomerDefaults = {
  id?: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  company: string | null;
  artist_name: string | null;
  instagram: string | null;
  customer_type: string | null;
  source: string | null;
  referral_source: string | null;
  status: string;
};

export function CustomerForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: CustomerDefaults;
  submitLabel: string;
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
        <TextField label="Company" name="company" defaultValue={defaults.company} />
        <TextField label="Artist name" name="artist_name" defaultValue={defaults.artist_name} />
        <TextField label="Instagram" name="instagram" defaultValue={defaults.instagram} placeholder="@handle" />
        <TextField label="Location" name="location" defaultValue={defaults.location} />
        <TextField
          label="Customer type"
          name="customer_type"
          defaultValue={defaults.customer_type}
          placeholder="e.g. artist, client, business"
        />
        <TextField label="Source" name="source" defaultValue={defaults.source} placeholder="How they found us" />
        <TextField
          label="Referral source"
          name="referral_source"
          defaultValue={defaults.referral_source}
        />
        <SelectField
          label="Status"
          name="status"
          defaultValue={defaults.status}
          options={STATUS_OPTIONS}
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
