"use client";

import { useActionState } from "react";
import { SelectField, TextField } from "@/components/form-field";
import { SubmitButton } from "@/components/submit-button";
import type { FormState } from "./actions";

export function ReferralForm({
  action,
  customerOptions,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  customerOptions: { value: string; label: string }[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {
    error: null,
  });

  const options = customerOptions.length > 0 ? customerOptions : [{ value: "", label: "No customers yet" }];

  return (
    <form action={formAction} className="max-w-lg space-y-6">
      <SelectField label="Referrer (existing customer)" name="referrer_customer_id" options={options} />
      <SelectField label="Referred (new customer)" name="referred_customer_id" options={options} />
      <TextField label="Source" name="source" placeholder="e.g. word of mouth, Instagram" />
      <TextField label="Referral code used (optional)" name="code" />

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <SubmitButton>Create referral</SubmitButton>
    </form>
  );
}
