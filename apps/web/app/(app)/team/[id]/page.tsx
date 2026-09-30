import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { computeEngineerHours, computeCommission } from "@/lib/engineer-metrics";
import { updateEngineerProfile } from "../actions";

export default async function TeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { id } = await params;
  const isSelf = profile.id === id;

  const [canViewTeam, canEdit, canViewFinancePermission] = await Promise.all([
    hasPermission(profile.role, "team", "view"),
    hasPermission(profile.role, "team", "edit"),
    hasPermission(profile.role, "payments", "view"),
  ]);

  // Viewing the team directory broadly requires 'team':view, but anyone
  // can always see their own profile/dashboard — matches the same "your
  // own data isn't someone else's data" principle used elsewhere.
  if (!canViewTeam && !isSelf) {
    return <EmptyState title="No access" description="You don't have permission to view team profiles." />;
  }
  const canViewFinance = canViewFinancePermission || isSelf;

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("profiles")
    .select("id, display_name, email, role, status, phone, specialties, commission_rate, created_at")
    .eq("id", id)
    .single();

  if (!member) notFound();

  const isEngineer = member.role === "engineer";
  // A dummy UUID that never matches a real row, used when the profile isn't
  // an engineer, so every branch of the Promise.all shares the same
  // query-builder type instead of a `never[]` fallback.
  const NONE_ID = "00000000-0000-0000-0000-000000000000";
  const engineerId = isEngineer ? id : NONE_ID;

  const [{ data: sessions }, { data: bookings }, { data: projects }] = await Promise.all([
    supabase
      .from("project_sessions")
      .select("id, starts_at, ends_at, status, booking_id, session_type, project_songs(title), projects(name)")
      .eq("engineer_id", engineerId)
      .is("deleted_at", null)
      .order("starts_at", { ascending: false }),
    supabase
      .from("bookings")
      .select("id, start_time, end_time, status, date, services(name)")
      .eq("staff_id", engineerId)
      .is("deleted_at", null),
    supabase.from("projects").select("id, name, stage, customer_id").eq("primary_engineer_id", engineerId).is("deleted_at", null),
  ]);

  const hours = isEngineer ? computeEngineerHours(sessions ?? [], bookings ?? []) : null;

  let revenue: number | null = null;
  if (isEngineer && canViewFinance) {
    const linkedBookingIds = new Set((sessions ?? []).map((s) => s.booking_id).filter((bid): bid is string => !!bid));
    const standaloneBookingIds = (bookings ?? []).filter((b) => !linkedBookingIds.has(b.id)).map((b) => b.id);
    const projectIds = (projects ?? []).map((p) => p.id);

    const projectIdsForQuery = projectIds.length > 0 ? projectIds : [NONE_ID];
    const bookingIdsForQuery = standaloneBookingIds.length > 0 ? standaloneBookingIds : [NONE_ID];

    const [{ data: projectPayments }, { data: bookingPayments }] = await Promise.all([
      supabase.from("payments").select("amount").eq("related_type", "project").eq("status", "completed").in("related_id", projectIdsForQuery),
      supabase.from("payments").select("amount").eq("related_type", "booking").eq("status", "completed").in("related_id", bookingIdsForQuery),
    ]);

    revenue =
      (projectPayments ?? []).reduce((s, p) => s + p.amount, 0) + (bookingPayments ?? []).reduce((s, p) => s + p.amount, 0);
  }

  const commission = revenue !== null ? computeCommission(revenue, member.commission_rate) : null;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Link href="/team" className="text-sm text-neutral-500 hover:underline">
          ← Back to team
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">{member.display_name || member.email}</h1>
        <p className="mt-1 text-sm text-neutral-500 capitalize">
          {member.role} · {member.status}
        </p>
      </div>

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-900">Profile</h2>
        {canEdit ? (
          <form action={updateEngineerProfile.bind(null, member.id)} className="mt-3 space-y-3">
            <div>
              <label className="block text-xs text-neutral-500">Specialties (comma-separated)</label>
              <input
                name="specialties"
                defaultValue={member.specialties?.join(", ") ?? ""}
                placeholder="mixing, mastering, vocal production"
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Commission rate (%)</label>
              <input
                name="commission_rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue={member.commission_rate !== null ? String(member.commission_rate) : ""}
                placeholder="Not set"
                className="mt-1 w-32 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
              />
            </div>
            <SubmitButton pendingLabel="Saving…" className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800">
              Save
            </SubmitButton>
          </form>
        ) : (
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Specialties" value={member.specialties?.join(", ") || null} />
            <Row label="Commission rate" value={member.commission_rate !== null ? `${member.commission_rate}%` : null} />
          </dl>
        )}
      </section>

      {isEngineer ? (
        <>
          <section className="rounded-lg border border-neutral-200 p-4">
            <h2 className="text-sm font-medium text-neutral-900">Studio activity</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Combines project sessions and standalone bookings — a booking already linked to a session is never counted twice.
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Scheduled" value={`${hours!.scheduledHours.toFixed(1)} hrs`} />
              <Metric label="Completed (billable)" value={`${hours!.completedHours.toFixed(1)} hrs`} />
              <Metric
                label="Utilization"
                value={hours!.utilizationPercentage !== null ? `${hours!.utilizationPercentage.toFixed(0)}%` : "—"}
              />
              {canViewFinance ? (
                <Metric label="Revenue attributed" value={revenue !== null ? `$${revenue.toFixed(2)}` : "—"} />
              ) : null}
            </dl>
            {canViewFinance ? (
              <p className="mt-3 text-sm text-neutral-700">
                Commission owed:{" "}
                <span className="font-medium">{commission !== null ? `$${commission.toFixed(2)}` : "Commission rate not set"}</span>
              </p>
            ) : null}
          </section>

          <section className="rounded-lg border border-neutral-200 p-4">
            <h2 className="text-sm font-medium text-neutral-900">Assigned projects</h2>
            {!projects || projects.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">No projects assigned as primary engineer.</p>
            ) : (
              <ul className="mt-3 divide-y divide-neutral-100">
                {projects.map((p) => (
                  <li key={p.id} className="py-2 text-sm">
                    <Link href={`/projects/${p.id}`} className="font-medium text-neutral-900 hover:underline">
                      {p.name}
                    </Link>
                    <span className="ml-2 text-xs text-neutral-500">{p.stage.replace(/_/g, " ")}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-neutral-200 p-4">
            <h2 className="text-sm font-medium text-neutral-900">Recent sessions</h2>
            {!sessions || sessions.length === 0 ? (
              <EmptyState title="No sessions yet" description="Sessions assigned to this engineer will show up here." />
            ) : (
              <ul className="mt-3 divide-y divide-neutral-100">
                {sessions.slice(0, 20).map((s) => {
                  const song = s.project_songs as { title: string } | null;
                  const project = s.projects as { name: string } | null;
                  return (
                    <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-neutral-800">
                        {s.session_type} {project ? `— ${project.name}` : ""} {song ? `(${song.title})` : ""}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {formatDateTime(s.starts_at)} · {s.status.replace(/_/g, " ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-100 pb-2 last:border-0">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right text-neutral-900">{value ?? "—"}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="text-lg font-semibold text-neutral-900">{value}</dd>
    </div>
  );
}
