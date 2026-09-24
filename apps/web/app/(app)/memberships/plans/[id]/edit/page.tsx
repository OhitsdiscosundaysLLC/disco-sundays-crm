import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { PlanForm } from "../../../plan-form";
import { updatePlan } from "../../../actions";

export default async function EditPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "memberships", "edit");
  if (!allowed) redirect("/memberships/plans");

  const { id } = await params;
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("membership_plans")
    .select("id, name, price, billing_interval, active")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!plan) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">Edit plan</h1>
      <PlanForm action={updatePlan} submitLabel="Save changes" defaults={plan} />
    </div>
  );
}
