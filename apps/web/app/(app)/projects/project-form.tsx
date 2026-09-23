"use client";

import { useActionState } from "react";
import { TextField, SelectField, TextAreaField } from "@/components/form-field";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "./actions";

export type ProjectDefaults = {
  id?: string;
  customer_id: string | null;
  service_id: string | null;
  name: string;
  status: string;
  start_date: string | null;
  due_date: string | null;
  completion_date: string | null;
  notes: string | null;
};

export function ProjectForm({
  action,
  defaults,
  submitLabel,
  customerOptions,
  serviceOptions,
  statusOptions,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: ProjectDefaults;
  submitLabel: string;
  customerOptions: { value: string; label: string }[];
  serviceOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
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
            customerOptions.length > 0
              ? customerOptions
              : [{ value: "", label: "No customers yet" }]
          }
        />
        <TextField label="Project name" name="name" defaultValue={defaults.name} required />
        <SelectField
          label="Service"
          name="service_id"
          defaultValue={defaults.service_id ?? ""}
          options={[{ value: "", label: "None" }, ...serviceOptions]}
        />
        <SelectField label="Status" name="status" defaultValue={defaults.status} options={statusOptions} />
        <TextField label="Start date" name="start_date" type="date" defaultValue={defaults.start_date} />
        <TextField label="Due date" name="due_date" type="date" defaultValue={defaults.due_date} />
        <TextField
          label="Completion date"
          name="completion_date"
          type="date"
          defaultValue={defaults.completion_date}
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
