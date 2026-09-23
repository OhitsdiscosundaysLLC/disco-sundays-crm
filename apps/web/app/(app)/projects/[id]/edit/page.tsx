import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel } from "@/lib/format";
import { ProjectForm } from "../../project-form";
import { updateProject } from "../../actions";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "edit");
  if (!allowed) redirect("/projects");

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: project }, { data: customers }, { data: services }, { data: statuses }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, customer_id, service_id, name, status, start_date, due_date, completion_date, notes")
        .eq("id", id)
        .is("deleted_at", null)
        .single(),
      supabase
        .from("customers")
        .select("id, display_name, email, phone")
        .is("deleted_at", null)
        .order("display_name")
        .limit(200),
      supabase.from("services").select("id, name").is("deleted_at", null).order("name"),
      supabase.from("project_statuses").select("slug, label").order("sort_order"),
    ]);

  if (!project) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">Edit project</h1>
      <ProjectForm
        action={updateProject}
        submitLabel="Save changes"
        customerOptions={(customers ?? []).map((c) => ({ value: c.id, label: customerLabel(c) }))}
        serviceOptions={(services ?? []).map((s) => ({ value: s.id, label: s.name }))}
        statusOptions={(statuses ?? []).map((s) => ({ value: s.slug, label: s.label }))}
        defaults={project}
      />
    </div>
  );
}
