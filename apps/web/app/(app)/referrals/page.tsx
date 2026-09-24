import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel, formatDate } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";

export default async function ReferralsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canView = await hasPermission(profile.role, "referrals", "view");
  if (!canView) {
    return <EmptyState title="No access" description="You don't have permission to view referrals." />;
  }

  const canCreate = await hasPermission(profile.role, "referrals", "create");

  const supabase = await createClient();
  const { data: referrals, error } = await supabase
    .from("referrals")
    .select(
      "id, qualification_status, created_at, referrer:referrer_customer_id(id, display_name, email, phone), referred:referred_customer_id(id, display_name, email, phone)"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Referrals</h1>
        {canCreate ? (
          <Link
            href="/referrals/new"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            New referral
          </Link>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-600">Could not load referrals.</p>
      ) : !referrals || referrals.length === 0 ? (
        <EmptyState
          title="No referrals yet"
          description={canCreate ? "Record a referral to get started." : "Referrals will show up here once they're added."}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-4 py-2 font-medium">Referrer</th>
                <th className="px-4 py-2 font-medium">Referred</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-2">
                    <Link href={`/referrals/${r.id}`} className="font-medium text-neutral-900 hover:underline">
                      {r.referrer ? customerLabel(r.referrer) : "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{r.referred ? customerLabel(r.referred) : "—"}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={r.qualification_status} />
                  </td>
                  <td className="px-4 py-2 text-neutral-500">{formatDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    qualified: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-700",
    pending: "bg-neutral-100 text-neutral-600",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-neutral-100 text-neutral-600"}`}>
      {status}
    </span>
  );
}
