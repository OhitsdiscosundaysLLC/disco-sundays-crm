"use client";

import { useActionState } from "react";
import { TextField, TextAreaField, CheckboxField } from "@/components/form-field";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "./actions";

export type ServiceDefaults = {
  id?: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number | null;
  duration_minutes: number | null;
  active: boolean;
  internal_notes: string | null;
};

export function ServiceForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: ServiceDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction} className="max-w-xl space-y-6">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <TextField label="Name" name="name" defaultValue={defaults.name} required />
      <TextAreaField label="Description" name="description" defaultValue={defaults.description} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextField label="Category" name="category" defaultValue={defaults.category} />
        <TextField
          label="Price (USD)"
          name="price"
          type="number"
          defaultValue={defaults.price !== null ? String(defaults.price) : null}
        />
        <TextField
          label="Duration (minutes)"
          name="duration_minutes"
          type="number"
          defaultValue={defaults.duration_minutes !== null ? String(defaults.duration_minutes) : null}
        />
      </div>
      <TextAreaField label="Internal notes" name="internal_notes" defaultValue={defaults.internal_notes} />
      <CheckboxField label="Active (bookable)" name="active" defaultChecked={defaults.active} />

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
