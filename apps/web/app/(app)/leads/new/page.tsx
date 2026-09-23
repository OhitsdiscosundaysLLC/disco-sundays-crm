import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { LeadForm } from "../lead-form";
import { createLead } from "../actions";

export default async function NewLeadPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "leads", "create");
  if (!allowed) redirect("/leads");

  const supabase = await createClient();
  const [{ data: statuses }, { data: staff }] = await Promise.all([
    supabase.from("lead_statuses").select("slug, label").order("sort_order"),
    supabase.from("profiles").select("id, display_name, email").order("display_name"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">New lead</h1>
      <LeadForm
        action={createLead}
        submitLabel="Create lead"
        statusOptions={(statuses ?? []).map((s) => ({ value: s.slug, label: s.label }))}
        staffOptions={(staff ?? []).map((p) => ({ value: p.id, label: p.display_name || p.email || p.id }))}
        defaults={{
          first_name: null,
          last_name: null,
          email: null,
          phone: null,
          status: "new",
          source: null,
          assigned_staff: null,
          service_interest: null,
          notes: null,
        }}
      />
    </div>
  );
}
