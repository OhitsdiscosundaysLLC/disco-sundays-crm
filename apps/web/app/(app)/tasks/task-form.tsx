"use client";

import { useActionState } from "react";
import { TextField, TextAreaField, SelectField } from "@/components/form-field";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "./actions";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export type TaskDefaults = {
  id?: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: string | null;
  due_date: string | null;
  related_id: string | null;
};

export function TaskForm({
  action,
  defaults,
  submitLabel,
  assigneeOptions,
  statusOptions,
  customerOptions,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: TaskDefaults;
  submitLabel: string;
  assigneeOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
  customerOptions: { value: string; label: string }[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction} className="max-w-xl space-y-6">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <input type="hidden" name="related_type" value="customer" />

      <TextField label="Title" name="title" defaultValue={defaults.title} required />
      <TextAreaField label="Description" name="description" defaultValue={defaults.description} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField label="Status" name="status" defaultValue={defaults.status} options={statusOptions} />
        <SelectField label="Priority" name="priority" defaultValue={defaults.priority} options={PRIORITY_OPTIONS} />
        <SelectField
          label="Assignee"
          name="assignee_id"
          defaultValue={defaults.assignee_id ?? ""}
          options={[{ value: "", label: "Unassigned" }, ...assigneeOptions]}
        />
        <TextField label="Due date" name="due_date" type="date" defaultValue={defaults.due_date} />
      </div>

      <SelectField
        label="Related customer (optional)"
        name="related_id"
        defaultValue={defaults.related_id ?? ""}
        options={[{ value: "", label: "None" }, ...customerOptions]}
      />

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
