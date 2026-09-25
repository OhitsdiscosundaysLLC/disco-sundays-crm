"use client";

import { useActionState } from "react";
import { TextField, SelectField } from "@/components/form-field";
import { SubmitButton } from "@/components/submit-button";
import { createAutomationRule, type AutomationFormState } from "./automation-actions";

const TRIGGER_OPTIONS = [
  { value: "customer.created", label: "Customer created" },
  { value: "lead.converted", label: "Lead converted" },
  { value: "booking.created", label: "Booking created" },
  { value: "booking.cancelled", label: "Booking cancelled" },
  { value: "project.created", label: "Project created" },
  { value: "gallery.created", label: "Gallery created" },
  { value: "membership.created", label: "Membership created" },
  { value: "membership.cancelled", label: "Membership cancelled" },
  { value: "referral.created", label: "Referral created" },
  { value: "reward.issued", label: "Reward issued" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function AutomationRuleForm({ assigneeOptions }: { assigneeOptions: { value: string; label: string }[] }) {
  const [state, formAction] = useActionState<AutomationFormState, FormData>(createAutomationRule, { error: null });

  return (
    <form action={formAction} className="space-y-4 rounded-md border border-neutral-200 p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label="Rule name" name="name" placeholder="Follow up on new lead" required />
        <SelectField label="When" name="trigger_event" options={TRIGGER_OPTIONS} />
        <TextField label="Task title to create" name="title" placeholder="Follow up with new customer" required />
        <SelectField label="Priority" name="priority" defaultValue="normal" options={PRIORITY_OPTIONS} />
        <TextField label="Due in (days, optional)" name="due_in_days" type="number" />
        <SelectField
          label="Assign to (optional)"
          name="assignee_id"
          options={[{ value: "", label: "Unassigned" }, ...assigneeOptions]}
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <SubmitButton className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800">
        Add rule
      </SubmitButton>
    </form>
  );
}
