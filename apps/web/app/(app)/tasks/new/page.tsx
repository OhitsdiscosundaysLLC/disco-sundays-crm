import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel } from "@/lib/format";
import { TaskForm } from "../task-form";
import { createTask } from "../actions";

export default async function NewTaskPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "tasks", "create");
  if (!allowed) redirect("/tasks");

  const supabase = await createClient();
  const [{ data: assignees }, { data: statuses }, { data: customers }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, email").order("display_name"),
    supabase.from("task_statuses").select("slug, label").order("sort_order"),
    supabase
      .from("customers")
      .select("id, display_name, email, phone")
      .is("deleted_at", null)
      .order("display_name")
      .limit(200),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">New task</h1>
      <TaskForm
        action={createTask}
        submitLabel="Create task"
        assigneeOptions={(assignees ?? []).map((p) => ({ value: p.id, label: p.display_name || p.email || p.id }))}
        statusOptions={(statuses ?? []).map((s) => ({ value: s.slug, label: s.label }))}
        customerOptions={(customers ?? []).map((c) => ({ value: c.id, label: customerLabel(c) }))}
        defaults={{
          title: "",
          description: null,
          status: "todo",
          priority: "normal",
          assignee_id: null,
          due_date: null,
          related_id: null,
        }}
      />
    </div>
  );
}
