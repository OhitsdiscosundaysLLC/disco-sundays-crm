"use client";

import { useActionState } from "react";
import { TextField, SelectField, TextAreaField } from "@/components/form-field";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "./actions";

const PROJECT_TYPE_OPTIONS = [
  { value: "single", label: "Single" },
  { value: "ep", label: "EP" },
  { value: "album", label: "Album" },
  { value: "mixtape", label: "Mixtape" },
  { value: "recording", label: "Recording" },
  { value: "production", label: "Production" },
  { value: "mixing", label: "Mixing" },
  { value: "mastering", label: "Mastering" },
  { value: "other", label: "Other" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export type ProjectDefaults = {
  id?: string;
  customer_id: string | null;
  service_id: string | null;
  name: string;
  project_type: string;
  artist_name: string | null;
  description: string | null;
  status: string;
  stage: string;
  priority: string;
  project_manager_id: string | null;
  primary_engineer_id: string | null;
  estimated_revenue: number | null;
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
  stageOptions,
  staffOptions,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: ProjectDefaults;
  submitLabel: string;
  customerOptions: { value: string; label: string }[];
  serviceOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
  stageOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
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
        <TextField label="Artist name" name="artist_name" defaultValue={defaults.artist_name} />
        <SelectField label="Project type" name="project_type" defaultValue={defaults.project_type} options={PROJECT_TYPE_OPTIONS} />
        <SelectField
          label="Service"
          name="service_id"
          defaultValue={defaults.service_id ?? ""}
          options={[{ value: "", label: "None" }, ...serviceOptions]}
        />
        <SelectField label="Status" name="status" defaultValue={defaults.status} options={statusOptions} />
        <SelectField label="Stage" name="stage" defaultValue={defaults.stage} options={stageOptions} />
        <SelectField label="Priority" name="priority" defaultValue={defaults.priority} options={PRIORITY_OPTIONS} />
        <SelectField
          label="Project manager"
          name="project_manager_id"
          defaultValue={defaults.project_manager_id ?? ""}
          options={[{ value: "", label: "Unassigned" }, ...staffOptions]}
        />
        <SelectField
          label="Primary engineer"
          name="primary_engineer_id"
          defaultValue={defaults.primary_engineer_id ?? ""}
          options={[{ value: "", label: "Unassigned" }, ...staffOptions]}
        />
        <TextField
          label="Estimated revenue (USD)"
          name="estimated_revenue"
          type="number"
          defaultValue={defaults.estimated_revenue !== null ? String(defaults.estimated_revenue) : null}
        />
        <TextField label="Start date" name="start_date" type="date" defaultValue={defaults.start_date} />
        <TextField label="Target delivery date" name="due_date" type="date" defaultValue={defaults.due_date} />
        <TextField
          label="Completion date"
          name="completion_date"
          type="date"
          defaultValue={defaults.completion_date}
        />
      </div>

      <TextAreaField label="Description" name="description" defaultValue={defaults.description} rows={3} />
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
