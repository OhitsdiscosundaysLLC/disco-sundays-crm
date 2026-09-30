import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel, formatDate } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { computeMembershipUsage, monthlyEquivalentPrice } from "@/lib/membership-usage";

const RENEWAL_WINDOW_DAYS = 14;
const LOW_USAGE_THRESHOLD_PCT = 25;
const AT_RISK_USAGE_THRESHOLD_PCT = 50;

export default async function MembershipsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canView = await hasPermission(profile.role, "memberships", "view");
  if (!canView) {
    return <EmptyState title="No access" description="You don't have permission to view memberships." />;
  }

  const canCreate = await hasPermission(profile.role, "memberships", "create");

  const supabase = await createClient();

  // Fetched without the usual `.is("deleted_at", null)` filter — recently
  // cancelled memberships (cancelMembership soft-deletes) are needed for
  // the cancellation-rate figure below, not just active ones.
  const { data: memberships, error } = await supabase
    .from("memberships")
    .select(
      "id, status, start_date, renewal_date, deleted_at, customer_id, customers(id, display_name, email, phone), membership_plans(name, price, billing_interval, included_hours)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const membershipIds = (memberships ?? []).map((m) => m.id);
  const { data: bookings } =
    membershipIds.length > 0
      ? await supabase
          .from("bookings")
          .select("membership_id, date, start_time, end_time, status")
          .in("membership_id", membershipIds)
          .eq("status", "completed")
          .is("deleted_at", null)
      : { data: [] as never[] };

  const bookingsByMembership = new Map<string, { date: string; start_time: string | null; end_time: string | null; status: string }[]>();
  for (const b of bookings ?? []) {
    if (!b.membership_id) continue;
    const list = bookingsByMembership.get(b.membership_id) ?? [];
    list.push(b);
    bookingsByMembership.set(b.membership_id, list);
  }

  const now = new Date();
  const renewalCutoff = new Date(now);
  renewalCutoff.setUTCDate(renewalCutoff.getUTCDate() + RENEWAL_WINDOW_DAYS);
  const cancelledCutoff = new Date(now);
  cancelledCutoff.setUTCDate(cancelledCutoff.getUTCDate() - 30);

  const rows = (memberships ?? []).map((m) => {
    const plan = m.membership_plans as { name: string; price: number | null; billing_interval: string; included_hours: number | null } | null;
    const usage = computeMembershipUsage({
      startDate: m.start_date,
      billingInterval: plan?.billing_interval ?? "monthly",
      includedHours: plan?.included_hours ?? null,
      completedBookings: bookingsByMembership.get(m.id) ?? [],
    });
    const renewalDate = m.renewal_date ? new Date(m.renewal_date) : null;
    const renewingSoon = m.status === "active" && !!renewalDate && renewalDate >= now && renewalDate <= renewalCutoff;
    const atRisk = renewingSoon && usage.usagePercentage !== null && usage.usagePercentage < AT_RISK_USAGE_THRESHOLD_PCT;
    const lowUsage = m.status === "active" && usage.usagePercentage !== null && usage.usagePercentage < LOW_USAGE_THRESHOLD_PCT;
    const overage = m.status === "active" && usage.overageHours > 0;

    return { membership: m, plan, usage, renewingSoon, atRisk, lowUsage, overage };
  });

  const activeRows = rows.filter((r) => r.membership.status === "active");
  const mrr = activeRows.reduce((sum, r) => sum + monthlyEquivalentPrice(r.plan?.price ?? null, r.plan?.billing_interval ?? "monthly"), 0);
  const renewingSoonRows = activeRows.filter((r) => r.renewingSoon);
  const atRiskRows = activeRows.filter((r) => r.atRisk);
  const lowUsageRows = activeRows.filter((r) => r.lowUsage);
  const overageRows = activeRows.filter((r) => r.overage);
  const cancelledRecentCount = rows.filter(
    (r) => r.membership.status === "cancelled" && r.membership.deleted_at && new Date(r.membership.deleted_at) >= cancelledCutoff
  ).length;

  const visibleRows = rows.filter((r) => r.membership.deleted_at === null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Memberships</h1>
        <div className="flex gap-2">
          <Link
            href="/memberships/plans"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
          >
            Manage plans
          </Link>
          {canCreate ? (
            <Link
              href="/memberships/new"
              className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              New membership
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600">Could not load memberships.</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Active memberships" value={String(activeRows.length)} />
            <SummaryCard label="Monthly recurring revenue" value={`$${mrr.toFixed(2)}`} />
            <SummaryCard label={`Renewing in ${RENEWAL_WINDOW_DAYS} days`} value={String(renewingSoonRows.length)} />
            <SummaryCard label="Cancelled (last 30 days)" value={String(cancelledRecentCount)} />
          </section>

          <SegmentSection
            title="At risk"
            description={`Renewing within ${RENEWAL_WINDOW_DAYS} days with under ${AT_RISK_USAGE_THRESHOLD_PCT}% of their hours used this period.`}
            rows={atRiskRows}
          />
          <SegmentSection
            title="Low usage"
            description={`Active this period at under ${LOW_USAGE_THRESHOLD_PCT}% of included hours.`}
            rows={lowUsageRows}
          />
          <SegmentSection title="Overage" description="Used more hours than their plan includes this period." rows={overageRows} showOverage />
          <SegmentSection title="Renewing soon" description={`Active memberships renewing within ${RENEWAL_WINDOW_DAYS} days.`} rows={renewingSoonRows} />

          {visibleRows.length === 0 ? (
            <EmptyState
              title="No memberships yet"
              description={
                canCreate ? "Assign a plan to a customer to get started." : "Memberships will show up here once they're added."
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-neutral-200">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500">
                    <th className="px-4 py-2 font-medium">Customer</th>
                    <th className="px-4 py-2 font-medium">Plan</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Usage</th>
                    <th className="px-4 py-2 font-medium">Renewal</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map(({ membership, plan, usage }) => (
                    <tr key={membership.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                      <td className="px-4 py-2">
                        <Link href={`/memberships/${membership.id}`} className="font-medium text-neutral-900 hover:underline">
                          {membership.customers ? customerLabel(membership.customers) : "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-neutral-600">{plan?.name || "—"}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            membership.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {membership.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-neutral-600">
                        {usage.includedHours !== null
                          ? `${usage.usedHours.toFixed(1)} / ${usage.includedHours} hrs${usage.overageHours > 0 ? " (over)" : ""}`
                          : `${usage.usedHours.toFixed(1)} hrs`}
                      </td>
                      <td className="px-4 py-2 text-neutral-500">{formatDate(membership.renewal_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

type SegmentRow = {
  membership: { id: string; customers: { id: string; display_name: string | null; email: string | null; phone: string | null } | null; renewal_date: string | null };
  plan: { name: string } | null;
  usage: { usagePercentage: number | null; overageHours: number; usedHours: number; includedHours: number | null };
};

function SegmentSection({
  title,
  description,
  rows,
  showOverage,
}: {
  title: string;
  description: string;
  rows: SegmentRow[];
  showOverage?: boolean;
}) {
  if (rows.length === 0) return null;

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <h2 className="text-sm font-medium text-neutral-900">
        {title} <span className="font-normal text-neutral-400">({rows.length})</span>
      </h2>
      <p className="mt-1 text-xs text-neutral-500">{description}</p>
      <ul className="mt-3 divide-y divide-neutral-100">
        {rows.map(({ membership, plan, usage }) => (
          <li key={membership.id} className="flex items-center justify-between py-2 text-sm">
            <Link href={`/memberships/${membership.id}`} className="font-medium text-neutral-900 hover:underline">
              {membership.customers ? customerLabel(membership.customers) : "—"}
            </Link>
            <span className="text-xs text-neutral-500">
              {plan?.name || "—"}
              {" · "}
              {showOverage
                ? `+${usage.overageHours.toFixed(1)} hrs over`
                : usage.usagePercentage !== null
                  ? `${usage.usagePercentage.toFixed(0)}% used`
                  : "—"}
              {membership.renewal_date ? ` · renews ${formatDate(membership.renewal_date)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
