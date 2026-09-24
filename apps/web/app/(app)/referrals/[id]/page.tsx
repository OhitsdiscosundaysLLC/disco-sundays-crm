import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel, formatDate, formatDateTime } from "@/lib/format";
import { SubmitButton } from "@/components/submit-button";
import { updateQualification } from "../actions";
import { IssueRewardForm } from "./issue-reward-form";

export default async function ReferralDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canView = await hasPermission(profile.role, "referrals", "view");
  if (!canView) redirect("/referrals");

  const [canEdit, canIssueReward] = await Promise.all([
    hasPermission(profile.role, "referrals", "edit"),
    hasPermission(profile.role, "rewards", "create"),
  ]);

  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: referral }, { data: existingReward }] = await Promise.all([
    supabase
      .from("referrals")
      .select(
        "*, referrer:referrer_customer_id(id, display_name, email, phone), referred:referred_customer_id(id, display_name, email, phone)"
      )
      .eq("id", id)
      .single(),
    supabase.from("reward_transactions").select("id, amount, created_at").eq("related_referral_id", id).eq("type", "referral_reward").maybeSingle(),
  ]);

  if (!referral) notFound();

  return (
    <div className="max-w-2xl space-y-8">
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Referral</h1>
        <p className="mt-1 text-sm text-neutral-500">Recorded {formatDate(referral.created_at)}</p>
      </div>

      <section className="rounded-lg border border-neutral-200 p-4">
        <dl className="space-y-2 text-sm">
          <Row
            label="Referrer"
            value={
              referral.referrer ? (
                <Link href={`/customers/${referral.referrer.id}`} className="hover:underline">
                  {customerLabel(referral.referrer)}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <Row
            label="Referred"
            value={
              referral.referred ? (
                <Link href={`/customers/${referral.referred.id}`} className="hover:underline">
                  {customerLabel(referral.referred)}
                </Link>
              ) : (
                "—"
              )
            }
          />
          <Row label="Source" value={referral.source || "—"} />
          <Row label="Code used" value={referral.code || "—"} />
        </dl>
      </section>

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-900">Qualification</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Status: <span className="font-medium">{referral.qualification_status}</span>
        </p>
        {canEdit ? (
          <div className="mt-3 flex gap-2">
            {(["pending", "qualified", "rejected"] as const).map((status) => (
              <form
                key={status}
                action={updateQualification.bind(null, referral.id, referral.referrer_customer_id, status)}
              >
                <SubmitButton
                  pendingLabel="…"
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    referral.qualification_status === status
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-300 hover:bg-neutral-50"
                  }`}
                >
                  {status}
                </SubmitButton>
              </form>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-900">Reward</h2>
        {existingReward ? (
          <p className="mt-2 text-sm text-neutral-700">
            ${existingReward.amount} issued to the referrer on {formatDateTime(existingReward.created_at)}.
          </p>
        ) : referral.qualification_status !== "qualified" ? (
          <p className="mt-2 text-sm text-neutral-500">
            Mark this referral qualified before issuing a reward.
          </p>
        ) : canIssueReward ? (
          <div className="mt-3">
            <IssueRewardForm referralId={referral.id} customerId={referral.referrer_customer_id} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">You don&apos;t have permission to issue rewards.</p>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-100 pb-2 last:border-0">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right text-neutral-900">{value}</dd>
    </div>
  );
}
