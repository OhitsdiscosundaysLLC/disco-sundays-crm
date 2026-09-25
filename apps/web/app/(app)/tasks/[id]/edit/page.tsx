import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel } from "@/lib/format";
import { TaskForm } from "../../task-form";
import { updateTask } from "../../actions";

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "tasks", "edit");
  if (!allowed) redirect("/tasks");

  const supabase = await createClient();
  const [{ data: task }, { data: assignees }, { data: statuses }, { data: customers }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, description, status, priority, assignee_id, due_date, related_type, related_id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("profiles").select("id, display_name, email").order("display_name"),
    supabase.from("task_statuses").select("slug, label").order("sort_order"),
    supabase
      .from("customers")
      .select("id, display_name, email, phone")
      .is("deleted_at", null)
      .order("display_name")
      .limit(200),
  ]);

  if (!task) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">Edit task</h1>
      <TaskForm
        action={updateTask}
        submitLabel="Save changes"
        assigneeOptions={(assignees ?? []).map((p) => ({ value: p.id, label: p.display_name || p.email || p.id }))}
        statusOptions={(statuses ?? []).map((s) => ({ value: s.slug, label: s.label }))}
        customerOptions={(customers ?? []).map((c) => ({ value: c.id, label: customerLabel(c) }))}
        defaults={{
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          assignee_id: task.assignee_id,
          due_date: task.due_date,
          related_id: task.related_type === "customer" ? task.related_id : null,
        }}
      />
    </div>
  );
}
