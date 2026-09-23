"use client";

import { useActionState } from "react";
import { TextField, SelectField, TextAreaField } from "@/components/form-field";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "./actions";

const PAYMENT_STATUS_OPTIONS = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "refunded", label: "Refunded" },
];

export type BookingDefaults = {
  id?: string;
  customer_id: string | null;
  service_id: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  staff_id: string | null;
  location: string | null;
  status: string;
  payment_status: string;
  notes: string | null;
};

export function BookingForm({
  action,
  defaults,
  submitLabel,
  customerOptions,
  serviceOptions,
  staffOptions,
  statusOptions,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaults: BookingDefaults;
  submitLabel: string;
  customerOptions: { value: string; label: string }[];
  serviceOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
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
        <SelectField
          label="Service"
          name="service_id"
          defaultValue={defaults.service_id ?? ""}
          options={
            serviceOptions.length > 0
              ? serviceOptions
              : [{ value: "", label: "No services yet" }]
          }
        />
        <TextField label="Date" name="date" type="date" defaultValue={defaults.date} required />
        <TextField label="Start time" name="start_time" type="time" defaultValue={defaults.start_time} />
        <TextField label="End time" name="end_time" type="time" defaultValue={defaults.end_time} />
        <TextField label="Location" name="location" defaultValue={defaults.location} />
        <SelectField label="Status" name="status" defaultValue={defaults.status} options={statusOptions} />
        <SelectField
          label="Payment status"
          name="payment_status"
          defaultValue={defaults.payment_status}
          options={PAYMENT_STATUS_OPTIONS}
        />
        {staffOptions.length > 0 ? (
          <SelectField
            label="Staff"
            name="staff_id"
            defaultValue={defaults.staff_id ?? ""}
            options={[{ value: "", label: "Unassigned" }, ...staffOptions]}
          />
        ) : null}
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
