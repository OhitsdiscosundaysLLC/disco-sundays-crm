import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel, formatDate } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { archiveProject } from "./actions";

const STAGE_STYLES: Record<string, string> = {
  inquiry: "bg-neutral-100 text-neutral-600",
  consultation: "bg-neutral-100 text-neutral-600",
  booked: "bg-blue-100 text-blue-700",
  pre_production: "bg-blue-100 text-blue-700",
  recording: "bg-amber-100 text-amber-800",
  editing: "bg-amber-100 text-amber-800",
  mixing: "bg-amber-100 text-amber-800",
  client_review: "bg-purple-100 text-purple-700",
  revision: "bg-purple-100 text-purple-700",
  mastering: "bg-amber-100 text-amber-800",
  final_approval: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
};

export default async function ProjectsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canView = await hasPermission(profile.role, "projects", "view");
  if (!canView) {
    return <EmptyState title="No access" description="You don't have permission to view projects." />;
  }

  const [canCreate, canDelete] = await Promise.all([
    hasPermission(profile.role, "projects", "create"),
    hasPermission(profile.role, "projects", "delete"),
  ]);

  const supabase = await createClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, project_type, priority, stage, due_date, customers(id, display_name, email, phone)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Projects</h1>
        {canCreate ? (
          <Link
            href="/projects/new"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            New project
          </Link>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-600">Could not load projects.</p>
      ) : !projects || projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description={canCreate ? "Add a project to get started." : "Projects will show up here once they're added."}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Stage</th>
                <th className="px-4 py-2 font-medium">Priority</th>
                <th className="px-4 py-2 font-medium">Target delivery</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-2 font-medium text-neutral-900">
                    <Link href={`/projects/${project.id}`} className="hover:underline">
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-neutral-600 capitalize">{project.project_type}</td>
                  <td className="px-4 py-2 text-neutral-600">
                    {project.customers ? customerLabel(project.customers) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_STYLES[project.stage] ?? STAGE_STYLES.inquiry}`}>
                      {project.stage.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-neutral-600 capitalize">{project.priority}</td>
                  <td className="px-4 py-2 text-neutral-500">{formatDate(project.due_date)}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-3">
                      <Link href={`/projects/${project.id}`} className="text-neutral-500 hover:text-neutral-900">
                        View
                      </Link>
                      {canDelete ? (
                        <form action={archiveProject.bind(null, project.id)}>
                          <SubmitButton pendingLabel="…" className="text-neutral-500 hover:text-red-600">
                            Archive
                          </SubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
