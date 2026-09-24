import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel } from "@/lib/format";
import { MembershipForm } from "../membership-form";
import { createMembership } from "../actions";

export default async function NewMembershipPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "memberships", "create");
  if (!allowed) redirect("/memberships");

  const supabase = await createClient();
  const [{ data: customers }, { data: plans }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, display_name, email, phone")
      .is("deleted_at", null)
      .order("display_name")
      .limit(200),
    supabase.from("membership_plans").select("id, name").is("deleted_at", null).eq("active", true).order("name"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">New membership</h1>
      <MembershipForm
        action={createMembership}
        submitLabel="Create membership"
        customerOptions={(customers ?? []).map((c) => ({ value: c.id, label: customerLabel(c) }))}
        planOptions={(plans ?? []).map((p) => ({ value: p.id, label: p.name }))}
        defaults={{
          customer_id: null,
          plan_id: null,
          status: "active",
          start_date: null,
          renewal_date: null,
          payment_provider: null,
          external_payment_id: null,
          notes: null,
        }}
      />
    </div>
  );
}
