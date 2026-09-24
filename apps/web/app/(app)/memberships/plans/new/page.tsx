import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PlanForm } from "../../plan-form";
import { createPlan } from "../../actions";

export default async function NewPlanPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "memberships", "create");
  if (!allowed) redirect("/memberships/plans");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">New plan</h1>
      <PlanForm
        action={createPlan}
        submitLabel="Create plan"
        defaults={{ name: "", price: null, billing_interval: "monthly", active: true }}
      />
    </div>
  );
}
