"use client";

import { useActionState } from "react";
import { TextField, SelectField, TextAreaField, CheckboxField } from "@/components/form-field";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "./actions";

const VISIBILITY_OPTIONS = [
  { value: "private", label: "Private (password required)" },
  { value: "public", label: "Public (anyone with the link)" },
];

export type GalleryDefaults = {
  id?: string;
  customer_id?: string | null;
  project_id: string | null;
  title: string;
  description: string | null;
  visibility: string;
  expires_at: string | null;
  allow_downloads: boolean;
  hasPassword?: boolean;
};

export function GalleryForm({
  action,
  defaults,
  submitLabel,
  customerOptions,
  projectOptions,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: GalleryDefaults;
  submitLabel: string;
  customerOptions?: { value: string; label: string }[];
  projectOptions: { value: string; label: string }[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {customerOptions ? (
          <SelectField
            label="Customer"
            name="customer_id"
            defaultValue={defaults.customer_id ?? ""}
            options={
              customerOptions.length > 0 ? customerOptions : [{ value: "", label: "No customers yet" }]
            }
          />
        ) : null}
        <SelectField
          label="Project"
          name="project_id"
          defaultValue={defaults.project_id ?? ""}
          options={[{ value: "", label: "None" }, ...projectOptions]}
        />
        <TextField label="Title" name="title" defaultValue={defaults.title} required />
        <SelectField
          label="Visibility"
          name="visibility"
          defaultValue={defaults.visibility}
          options={VISIBILITY_OPTIONS}
        />
      </div>

      <TextAreaField label="Description" name="description" defaultValue={defaults.description} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label={defaults.hasPassword ? "New password (leave blank to keep current)" : "Password"}
          name="password"
          type="text"
          placeholder={defaults.hasPassword ? "Unchanged" : undefined}
        />
        <TextField label="Expires (optional)" name="expires_at" type="date" defaultValue={defaults.expires_at} />
      </div>

      <CheckboxField
        label="Allow downloads"
        name="allow_downloads"
        defaultChecked={defaults.allow_downloads}
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
