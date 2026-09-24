import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel } from "@/lib/format";
import { MembershipForm } from "../../membership-form";
import { updateMembership } from "../../actions";

export default async function EditMembershipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "memberships", "edit");
  if (!allowed) redirect("/memberships");

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: membership }, { data: customers }, { data: plans }] = await Promise.all([
    supabase
      .from("memberships")
      .select(
        "id, customer_id, plan_id, status, start_date, renewal_date, payment_provider, external_payment_id, notes"
      )
      .eq("id", id)
      .is("deleted_at", null)
      .single(),
    supabase
      .from("customers")
      .select("id, display_name, email, phone")
      .is("deleted_at", null)
      .order("display_name")
      .limit(200),
    supabase.from("membership_plans").select("id, name").is("deleted_at", null).order("name"),
  ]);

  if (!membership) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">Edit membership</h1>
      <MembershipForm
        action={updateMembership}
        submitLabel="Save changes"
        customerOptions={(customers ?? []).map((c) => ({ value: c.id, label: customerLabel(c) }))}
        planOptions={(plans ?? []).map((p) => ({ value: p.id, label: p.name }))}
        defaults={membership}
      />
    </div>
  );
}
