"use client";

import { useActionState } from "react";
import { TextField } from "@/components/form-field";
import { SubmitButton } from "@/components/submit-button";
import { issueReferralReward, type FormState } from "../actions";

export function IssueRewardForm({ referralId, customerId }: { referralId: string; customerId: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(issueReferralReward, {
    error: null,
  });

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="referral_id" value={referralId} />
      <input type="hidden" name="customer_id" value={customerId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Reward amount (USD)" name="amount" type="number" required />
        <TextField label="Reason" name="reason" placeholder="e.g. successful referral" />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <SubmitButton pendingLabel="Issuing…">Issue reward</SubmitButton>
    </form>
  );
}
