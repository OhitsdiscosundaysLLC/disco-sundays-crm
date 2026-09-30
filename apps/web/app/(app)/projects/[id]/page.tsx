import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel, formatDate, formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import {
  createSong,
  updateSongStatusField,
  deleteSong,
  createSession,
  updateSessionStatus,
  createRevision,
  completeRevision,
  createDelivery,
  updateProjectStage,
} from "../actions";

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

const SONG_SUB_STATUS_OPTIONS = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "complete", label: "Complete" },
];

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canView = await hasPermission(profile.role, "projects", "view");
  if (!canView) {
    return <EmptyState title="No access" description="You don't have permission to view projects." />;
  }

  const [canEdit, canCreate, canDelete] = await Promise.all([
    hasPermission(profile.role, "projects", "edit"),
    hasPermission(profile.role, "projects", "create"),
    hasPermission(profile.role, "projects", "delete"),
  ]);

  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, project_type, artist_name, description, status, stage, priority, start_date, due_date, completion_date, estimated_revenue, notes, customer_id, customers(id, display_name, email, phone), primary_engineer:profiles!primary_engineer_id(display_name, email), project_manager:profiles!project_manager_id(display_name, email)"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!project) notFound();

  const [
    { data: songs },
    { data: sessions },
    { data: revisions },
    { data: deliveries },
    { data: payments },
    { data: stages },
    { data: staff },
    { data: activities },
  ] = await Promise.all([
    supabase
      .from("project_songs")
      .select("id, title, track_number, status, genre, bpm, song_key, recording_status, editing_status, mixing_status, mastering_status, final_approval")
      .eq("project_id", id)
      .is("deleted_at", null)
      .order("track_number", { ascending: true, nullsFirst: false }),
    supabase
      .from("project_sessions")
      .select("id, session_type, starts_at, ends_at, status, notes, engineer:profiles(display_name, email), project_songs(title)")
      .eq("project_id", id)
      .is("deleted_at", null)
      .order("starts_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("project_revisions")
      .select("id, revision_number, description, status, requested_at, completed_at, project_songs(title)")
      .eq("project_id", id)
      .order("revision_number", { ascending: false }),
    supabase
      .from("project_deliveries")
      .select("id, delivery_type, delivered_at, notes, profiles(display_name, email)")
      .eq("project_id", id)
      .order("delivered_at", { ascending: false }),
    supabase
      .from("payments")
      .select("id, amount, currency, provider, status, paid_at")
      .eq("related_type", "project")
      .eq("related_id", id),
    supabase.from("project_stages").select("slug, label").order("sort_order"),
    supabase.from("profiles").select("id, display_name, email").order("display_name"),
    supabase
      .from("activities")
      .select("id, type, title, created_at")
      .eq("customer_id", project.customer_id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const customer = project.customers as { id: string; display_name: string | null; email: string | null; phone: string | null } | null;
  const manager = project.project_manager as { display_name: string | null; email: string | null } | null;
  const engineer = project.primary_engineer as { display_name: string | null; email: string | null } | null;

  const actualRevenue = (payments ?? [])
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);
  const balance = project.estimated_revenue !== null ? Math.max(project.estimated_revenue - actualRevenue, 0) : null;

  const songOptions = (songs ?? []).map((s) => ({ value: s.id, label: s.title }));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            {project.project_type} {project.artist_name ? `· ${project.artist_name}` : ""}
          </p>
          <h1 className="text-xl font-semibold text-neutral-900">{project.name}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {customer ? (
              <Link href={`/customers/${customer.id}`} className="hover:underline">
                {customerLabel(customer)}
              </Link>
            ) : (
              "—"
            )}
          </p>
        </div>
        {canEdit ? (
          <Link
            href={`/projects/${project.id}/edit`}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
          >
            Edit project
          </Link>
        ) : null}
      </div>

      <section className="rounded-lg border border-neutral-200 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_STYLES[project.stage] ?? STAGE_STYLES.inquiry}`}>
            {(stages ?? []).find((s) => s.slug === project.stage)?.label ?? project.stage}
          </span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">{project.priority} priority</span>
          {canEdit ? (
            <AutoSubmitSelect
              action={updateProjectStage.bind(null, project.id)}
              name="stage"
              defaultValue={project.stage}
              className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
              options={(stages ?? []).map((s) => ({ value: s.slug, label: `Move to: ${s.label}` }))}
            />
          ) : null}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-neutral-500">Project manager</dt>
            <dd className="text-sm text-neutral-900">{manager?.display_name || manager?.email || "Unassigned"}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Primary engineer</dt>
            <dd className="text-sm text-neutral-900">{engineer?.display_name || engineer?.email || "Unassigned"}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Start date</dt>
            <dd className="text-sm text-neutral-900">{formatDate(project.start_date)}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Target delivery</dt>
            <dd className="text-sm text-neutral-900">{formatDate(project.due_date)}</dd>
          </div>
        </dl>

        {project.description ? <p className="mt-4 text-sm text-neutral-700">{project.description}</p> : null}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 p-4">
          <p className="text-xs text-neutral-500">Estimated revenue</p>
          <p className="mt-1 text-xl font-semibold text-neutral-900">
            {project.estimated_revenue !== null ? `$${project.estimated_revenue.toFixed(2)}` : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4">
          <p className="text-xs text-neutral-500">Actual revenue (completed payments)</p>
          <p className="mt-1 text-xl font-semibold text-neutral-900">${actualRevenue.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4">
          <p className="text-xs text-neutral-500">Outstanding balance</p>
          <p className="mt-1 text-xl font-semibold text-neutral-900">{balance !== null ? `$${balance.toFixed(2)}` : "—"}</p>
        </div>
      </section>

      {/* Songs */}
      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-900">Songs</h2>
        {!songs || songs.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No songs added yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-neutral-500">
                  <th className="py-1 pr-4">#</th>
                  <th className="py-1 pr-4">Title</th>
                  <th className="py-1 pr-4">Recording</th>
                  <th className="py-1 pr-4">Editing</th>
                  <th className="py-1 pr-4">Mixing</th>
                  <th className="py-1 pr-4">Mastering</th>
                  <th className="py-1 pr-4">Approved</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {songs.map((song) => (
                  <tr key={song.id} className="border-t border-neutral-100">
                    <td className="py-2 pr-4 text-neutral-500">{song.track_number ?? "—"}</td>
                    <td className="py-2 pr-4 font-medium text-neutral-900">{song.title}</td>
                    {(["recording_status", "editing_status", "mixing_status", "mastering_status"] as const).map((field) => (
                      <td key={field} className="py-2 pr-4">
                        {canEdit ? (
                          <AutoSubmitSelect
                            action={updateSongStatusField.bind(null, song.id, project.id, field)}
                            name="value"
                            defaultValue={song[field]}
                            options={SONG_SUB_STATUS_OPTIONS}
                          />
                        ) : (
                          <span className="text-xs text-neutral-600">{song[field].replace("_", " ")}</span>
                        )}
                      </td>
                    ))}
                    <td className="py-2 pr-4 text-xs">{song.final_approval ? "✓" : "—"}</td>
                    <td className="py-2">
                      {canDelete ? (
                        <form action={deleteSong.bind(null, song.id, project.id)}>
                          <SubmitButton pendingLabel="…" className="text-xs text-neutral-500 hover:text-red-600">
                            Remove
                          </SubmitButton>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canCreate ? (
          <form action={createSong} className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <input type="hidden" name="project_id" value={project.id} />
            <input name="track_number" type="number" placeholder="#" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            <input name="title" placeholder="Song title" required className="col-span-2 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            <input name="genre" placeholder="Genre" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            <SubmitButton pendingLabel="Adding…" className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800">
              Add song
            </SubmitButton>
          </form>
        ) : null}
      </section>

      {/* Sessions */}
      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-900">Sessions</h2>
        {!sessions || sessions.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No sessions scheduled yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100">
            {sessions.map((session) => {
              const eng = session.engineer as { display_name: string | null; email: string | null } | null;
              const song = session.project_songs as { title: string } | null;
              return (
                <li key={session.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="text-neutral-900">
                      {session.session_type} {song ? `— ${song.title}` : ""}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatDateTime(session.starts_at)} · {eng?.display_name || eng?.email || "Unassigned"}
                    </p>
                  </div>
                  {canEdit ? (
                    <AutoSubmitSelect
                      action={updateSessionStatus.bind(null, session.id, project.id)}
                      name="value"
                      defaultValue={session.status}
                      options={["scheduled", "in_progress", "completed", "cancelled", "no_show"].map((s) => ({
                        value: s,
                        label: s.replace("_", " "),
                      }))}
                    />
                  ) : (
                    <span className="text-xs text-neutral-600">{session.status}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {canCreate ? (
          <form action={createSession} className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-6">
            <input type="hidden" name="project_id" value={project.id} />
            <select name="song_id" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
              <option value="">No song</option>
              {songOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select name="engineer_id" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
              <option value="">Unassigned</option>
              {(staff ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name || p.email}
                </option>
              ))}
            </select>
            <select name="session_type" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
              {["recording", "editing", "mixing", "mastering", "consultation", "other"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input name="starts_at" type="datetime-local" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            <input name="ends_at" type="datetime-local" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            <SubmitButton pendingLabel="Adding…" className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800">
              Add session
            </SubmitButton>
          </form>
        ) : null}
      </section>

      {/* Revisions */}
      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-900">Revisions</h2>
        {!revisions || revisions.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No revisions requested yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100">
            {revisions.map((rev) => {
              const song = rev.project_songs as { title: string } | null;
              return (
                <li key={rev.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="text-neutral-900">
                      Revision #{rev.revision_number} {song ? `— ${song.title}` : ""}
                    </p>
                    <p className="text-xs text-neutral-500">{rev.description || "No description"} · requested {formatDate(rev.requested_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${rev.status === "completed" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                      {rev.status.replace("_", " ")}
                    </span>
                    {canEdit && rev.status !== "completed" ? (
                      <form action={completeRevision.bind(null, rev.id, project.id)}>
                        <SubmitButton pendingLabel="…" className="text-xs text-neutral-500 hover:text-green-700">
                          Mark complete
                        </SubmitButton>
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {canCreate ? (
          <form action={createRevision} className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <input type="hidden" name="project_id" value={project.id} />
            <input name="revision_number" type="number" placeholder="Revision #" required className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            <select name="song_id" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
              <option value="">No specific song</option>
              {songOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input name="description" placeholder="What needs to change?" className="col-span-2 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            <SubmitButton pendingLabel="Adding…" className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800">
              Log revision
            </SubmitButton>
          </form>
        ) : null}
      </section>

      {/* Deliveries */}
      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-900">Deliveries</h2>
        {!deliveries || deliveries.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Nothing delivered yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100">
            {deliveries.map((d) => {
              const by = d.profiles as { display_name: string | null; email: string | null } | null;
              return (
                <li key={d.id} className="py-2.5 text-sm">
                  <p className="text-neutral-900">{d.delivery_type.replace("_", " ")}</p>
                  <p className="text-xs text-neutral-500">
                    {formatDateTime(d.delivered_at)} · {by?.display_name || by?.email || "—"} {d.notes ? `· ${d.notes}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        {canCreate ? (
          <form action={createDelivery} className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input type="hidden" name="project_id" value={project.id} />
            <select name="delivery_type" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
              {["rough_mix", "final_mix", "master", "stems", "full_package", "other"].map((t) => (
                <option key={t} value={t}>
                  {t.replace("_", " ")}
                </option>
              ))}
            </select>
            <input name="notes" placeholder="Notes (optional)" className="col-span-2 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            <SubmitButton pendingLabel="Recording…" className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800">
              Record delivery
            </SubmitButton>
          </form>
        ) : null}
      </section>

      {/* Activity timeline */}
      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-900">Customer activity</h2>
        <p className="mt-1 text-xs text-neutral-500">Full activity timeline for {customer ? customerLabel(customer) : "this customer"}, not filtered to this project alone.</p>
        {!activities || activities.length === 0 ? (
          <EmptyState title="No activity yet" description="Actions on this project will show up here." />
        ) : (
          <ul className="mt-3 space-y-3">
            {activities.map((activity) => (
              <li key={activity.id} className="border-t border-neutral-100 pt-3 first:border-0 first:pt-0">
                <p className="text-sm text-neutral-800">{activity.title}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{formatDateTime(activity.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
