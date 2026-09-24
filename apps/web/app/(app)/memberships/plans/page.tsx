import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { archivePlan } from "../actions";

export default async function MembershipPlansPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canView = await hasPermission(profile.role, "memberships", "view");
  if (!canView) redirect("/memberships");

  const [canCreate, canEdit, canDelete] = await Promise.all([
    hasPermission(profile.role, "memberships", "create"),
    hasPermission(profile.role, "memberships", "edit"),
    hasPermission(profile.role, "memberships", "delete"),
  ]);

  const supabase = await createClient();
  const { data: plans, error } = await supabase
    .from("membership_plans")
    .select("id, name, price, billing_interval, active")
    .is("deleted_at", null)
    .order("name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Membership plans</h1>
          <Link href="/memberships" className="text-sm text-neutral-500 hover:underline">
            ← Back to memberships
          </Link>
        </div>
        {canCreate ? (
          <Link
            href="/memberships/plans/new"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            New plan
          </Link>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-600">Could not load plans.</p>
      ) : !plans || plans.length === 0 ? (
        <EmptyState
          title="No plans yet"
          description={canCreate ? "Create a plan before assigning memberships." : "Plans will show up here once they're added."}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Price</th>
                <th className="px-4 py-2 font-medium">Billing</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-2 font-medium text-neutral-900">{plan.name}</td>
                  <td className="px-4 py-2 text-neutral-600">{plan.price != null ? `$${plan.price}` : "—"}</td>
                  <td className="px-4 py-2 text-neutral-600">{plan.billing_interval}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        plan.active ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {plan.active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-3">
                      {canEdit ? (
                        <Link href={`/memberships/plans/${plan.id}/edit`} className="text-neutral-500 hover:text-neutral-900">
                          Edit
                        </Link>
                      ) : null}
                      {canDelete ? (
                        <form action={archivePlan.bind(null, plan.id)}>
                          <SubmitButton pendingLabel="…" className="text-neutral-500 hover:text-red-600">
                            Archive
                          </SubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
