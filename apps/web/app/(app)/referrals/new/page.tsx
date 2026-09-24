import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel } from "@/lib/format";
import { ReferralForm } from "../referral-form";
import { createReferral } from "../actions";

export default async function NewReferralPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "referrals", "create");
  if (!allowed) redirect("/referrals");

  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("id, display_name, email, phone")
    .is("deleted_at", null)
    .order("display_name")
    .limit(200);

  const options = (customers ?? []).map((c) => ({ value: c.id, label: customerLabel(c) }));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">New referral</h1>
      <ReferralForm action={createReferral} customerOptions={options} />
    </div>
  );
}
