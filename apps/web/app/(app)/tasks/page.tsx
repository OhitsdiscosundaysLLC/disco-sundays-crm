import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel, formatDate } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { setTaskStatus, deleteTask } from "./actions";

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-neutral-100 text-neutral-500",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-800",
  urgent: "bg-red-100 text-red-700",
};

const STATUS_STYLES: Record<string, string> = {
  todo: "bg-neutral-100 text-neutral-600",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-800",
  cancelled: "bg-neutral-100 text-neutral-400",
};

export default async function TasksPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canView = await hasPermission(profile.role, "tasks", "view");
  if (!canView) {
    return <EmptyState title="No access" description="You don't have permission to view tasks." />;
  }

  const [canCreate, canEdit, canDelete] = await Promise.all([
    hasPermission(profile.role, "tasks", "create"),
    hasPermission(profile.role, "tasks", "edit"),
    hasPermission(profile.role, "tasks", "delete"),
  ]);

  const supabase = await createClient();
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(
      "id, title, status, priority, due_date, assignee_id, related_type, related_id, profiles:assignee_id(display_name, email)"
    )
    .is("deleted_at", null)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  // related_id is polymorphic (no FK — see 0013_phase_tasks.sql), so it
  // can't use PostgREST's automatic embedding; fetch the related customers
  // in a second pass and map by id.
  const customerIds = (tasks ?? [])
    .filter((t) => t.related_type === "customer" && t.related_id)
    .map((t) => t.related_id as string);
  const relatedCustomers = customerIds.length
    ? await supabase
        .from("customers")
        .select("id, display_name, email, phone")
        .in("id", customerIds)
        .then((r) => new Map((r.data ?? []).map((c) => [c.id, c])))
    : new Map<string, { display_name: string | null; email: string | null; phone: string | null }>();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Tasks</h1>
        {canCreate ? (
          <Link
            href="/tasks/new"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            New task
          </Link>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-600">Could not load tasks.</p>
      ) : !tasks || tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description={canCreate ? "Create your first task to track follow-ups and to-dos." : "Tasks will show up here once created."}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Related</th>
                <th className="px-4 py-2 font-medium">Assignee</th>
                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 font-medium">Priority</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const assignee = task.profiles as { display_name: string | null; email: string | null } | null;
                const related = task.related_id ? relatedCustomers.get(task.related_id) ?? null : null;
                return (
                  <tr key={task.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                    <td className="px-4 py-2 font-medium text-neutral-900">{task.title}</td>
                    <td className="px-4 py-2 text-neutral-600">{related ? customerLabel(related) : "—"}</td>
                    <td className="px-4 py-2 text-neutral-600">{assignee?.display_name || assignee?.email || "Unassigned"}</td>
                    <td className="px-4 py-2 text-neutral-600">{formatDate(task.due_date)}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.normal}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[task.status] ?? STATUS_STYLES.todo}`}>
                        {task.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-3">
                        {canEdit && task.status !== "done" ? (
                          <form action={setTaskStatus.bind(null, task.id, "done")}>
                            <SubmitButton pendingLabel="…" className="text-neutral-500 hover:text-green-700">
                              Mark done
                            </SubmitButton>
                          </form>
                        ) : null}
                        {canEdit ? (
                          <Link href={`/tasks/${task.id}/edit`} className="text-neutral-500 hover:text-neutral-900">
                            Edit
                          </Link>
                        ) : null}
                        {canDelete ? (
                          <form action={deleteTask.bind(null, task.id)}>
                            <SubmitButton pendingLabel="…" className="text-neutral-500 hover:text-red-600">
                              Delete
                            </SubmitButton>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
