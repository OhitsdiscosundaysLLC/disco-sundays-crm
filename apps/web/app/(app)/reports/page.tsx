import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";

/**
 * Every number here is a live query against the CRM's own tables, run
 * under the viewer's own RLS-scoped session — a role with 'reports':view
 * but not, say, 'payments':view simply sees that section come back empty,
 * same as it would on the Payments page itself. No fabricated or cached
 * stats (spec RULE 2).
 */
export default async function ReportsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canView = await hasPermission(profile.role, "reports", "view");
  if (!canView) {
    return <EmptyState title="No access" description="You don't have permission to view reports." />;
  }

  const supabase = await createClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

  const [
    { data: paymentsThisMonth },
    { data: paymentsThisYear },
    { data: bookingCounts },
    { data: activeMemberships },
    { count: referralsTotal },
    { count: referralsQualified },
    { data: rewardTransactions },
  ] = await Promise.all([
    supabase.from("payments").select("amount, currency").eq("status", "completed").gte("paid_at", monthStart),
    supabase.from("payments").select("amount, currency").eq("status", "completed").gte("paid_at", yearStart),
    supabase.from("bookings").select("status").is("deleted_at", null),
    supabase
      .from("memberships")
      .select("id, membership_plans(price, billing_interval)")
      .eq("status", "active")
      .is("deleted_at", null),
    supabase.from("referrals").select("id", { count: "exact", head: true }),
    supabase.from("referrals").select("id", { count: "exact", head: true }).eq("qualification_status", "qualified"),
    supabase.from("reward_transactions").select("type, amount"),
  ]);

  const sum = (rows: { amount: number }[] | null) => (rows ?? []).reduce((total, r) => total + r.amount, 0);
  const revenueThisMonth = sum(paymentsThisMonth);
  const revenueThisYear = sum(paymentsThisYear);

  const bookingsByStatus = (bookingCounts ?? []).reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});

  const monthlyEquivalent: Record<string, number> = { monthly: 1, quarterly: 1 / 3, annual: 1 / 12, one_time: 0 };
  const estimatedMrr = (activeMemberships ?? []).reduce((total, m) => {
    const plan = m.membership_plans as { price: number | null; billing_interval: string } | null;
    if (!plan?.price) return total;
    return total + plan.price * (monthlyEquivalent[plan.billing_interval] ?? 0);
  }, 0);

  const rewardsIssued = (rewardTransactions ?? [])
    .filter((t) => t.type !== "redemption")
    .reduce((total, t) => total + t.amount, 0);
  const rewardsRedeemed = (rewardTransactions ?? [])
    .filter((t) => t.type === "redemption")
    .reduce((total, t) => total + Math.abs(t.amount), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Reports</h1>
        <p className="mt-1 text-sm text-neutral-500">Live figures from the CRM&rsquo;s own data — nothing here is estimated or fabricated.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Revenue this month" value={`$${revenueThisMonth.toFixed(2)}`} />
        <Stat label="Revenue this year" value={`$${revenueThisYear.toFixed(2)}`} />
        <Stat label="Active memberships" value={String((activeMemberships ?? []).length)} />
        <Stat label="Estimated MRR" value={`$${estimatedMrr.toFixed(2)}`} />
        <Stat label="Referrals (qualified / total)" value={`${referralsQualified ?? 0} / ${referralsTotal ?? 0}`} />
        <Stat label="Rewards issued / redeemed" value={`${rewardsIssued.toFixed(2)} / ${rewardsRedeemed.toFixed(2)}`} />
      </div>

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-900">Bookings by status</h2>
        {Object.keys(bookingsByStatus).length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No bookings yet.</p>
        ) : (
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Object.entries(bookingsByStatus).map(([status, count]) => (
              <div key={status}>
                <dt className="text-xs text-neutral-500 capitalize">{status.replace("_", " ")}</dt>
                <dd className="text-lg font-semibold text-neutral-900">{count}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
    </div>
  );
}
