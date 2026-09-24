import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel, formatDate } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";

export default async function MembershipsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canView = await hasPermission(profile.role, "memberships", "view");
  if (!canView) {
    return <EmptyState title="No access" description="You don't have permission to view memberships." />;
  }

  const canCreate = await hasPermission(profile.role, "memberships", "create");

  const supabase = await createClient();
  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("id, status, renewal_date, customers(id, display_name, email, phone), membership_plans(name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

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
      ) : !memberships || memberships.length === 0 ? (
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
                <th className="px-4 py-2 font-medium">Renewal</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((membership) => (
                <tr key={membership.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-2">
                    <Link href={`/memberships/${membership.id}`} className="font-medium text-neutral-900 hover:underline">
                      {membership.customers ? customerLabel(membership.customers) : "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{membership.membership_plans?.name || "—"}</td>
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
                  <td className="px-4 py-2 text-neutral-500">{formatDate(membership.renewal_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
