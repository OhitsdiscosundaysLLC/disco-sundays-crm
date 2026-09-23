import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel } from "@/lib/format";
import { ProjectForm } from "../project-form";
import { createProject } from "../actions";

export default async function NewProjectPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "create");
  if (!allowed) redirect("/projects");

  const supabase = await createClient();
  const [{ data: customers }, { data: services }, { data: statuses }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, display_name, email, phone")
      .is("deleted_at", null)
      .order("display_name")
      .limit(200),
    supabase.from("services").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("project_statuses").select("slug, label").order("sort_order"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">New project</h1>
      <ProjectForm
        action={createProject}
        submitLabel="Create project"
        customerOptions={(customers ?? []).map((c) => ({ value: c.id, label: customerLabel(c) }))}
        serviceOptions={(services ?? []).map((s) => ({ value: s.id, label: s.name }))}
        statusOptions={(statuses ?? []).map((s) => ({ value: s.slug, label: s.label }))}
        defaults={{
          customer_id: null,
          service_id: null,
          name: "",
          status: "planning",
          start_date: null,
          due_date: null,
          completion_date: null,
          notes: null,
        }}
      />
    </div>
  );
}
