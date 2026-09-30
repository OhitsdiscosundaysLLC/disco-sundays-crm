import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";
import { computeEngineerHours, computeCommission } from "@/lib/engineer-metrics";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  invited: "bg-amber-100 text-amber-800",
  disabled: "bg-neutral-100 text-neutral-500",
};

export default async function TeamPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canView = await hasPermission(profile.role, "team", "view");
  if (!canView) {
    return <EmptyState title="No access" description="You don't have permission to view the team directory." />;
  }

  const [canViewFinance] = await Promise.all([hasPermission(profile.role, "payments", "view")]);

  const supabase = await createClient();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, role, status, specialties, commission_rate")
    .order("display_name", { ascending: true, nullsFirst: false });

  // A dummy UUID that will never match a real row, used instead of an
  // empty `.in()` array so every branch of the Promise.all shares the same
  // query-builder type (avoids a `never[]` inference mismatch).
  const NONE_ID = "00000000-0000-0000-0000-000000000000";
  const engineerIds = (profiles ?? []).filter((p) => p.role === "engineer").map((p) => p.id);
  const engineerIdsForQuery = engineerIds.length > 0 ? engineerIds : [NONE_ID];

  const [{ data: sessions }, { data: bookings }, { data: projects }] = await Promise.all([
    supabase
      .from("project_sessions")
      .select("engineer_id, starts_at, ends_at, status, booking_id")
      .in("engineer_id", engineerIdsForQuery)
      .is("deleted_at", null),
    supabase
      .from("bookings")
      .select("id, staff_id, start_time, end_time, status, date")
      .in("staff_id", engineerIdsForQuery)
      .is("deleted_at", null),
    supabase.from("projects").select("id, primary_engineer_id").in("primary_engineer_id", engineerIdsForQuery).is("deleted_at", null),
  ]);

  const sessionsByEngineer = new Map<string, NonNullable<typeof sessions>[number][]>();
  for (const s of sessions ?? []) {
    if (!s.engineer_id) continue;
    const list = sessionsByEngineer.get(s.engineer_id) ?? [];
    list.push(s);
    sessionsByEngineer.set(s.engineer_id, list);
  }
  const bookingsByEngineer = new Map<string, NonNullable<typeof bookings>[number][]>();
  for (const b of bookings ?? []) {
    if (!b.staff_id) continue;
    const list = bookingsByEngineer.get(b.staff_id) ?? [];
    list.push(b);
    bookingsByEngineer.set(b.staff_id, list);
  }
  const projectIdsByEngineer = new Map<string, string[]>();
  for (const p of projects ?? []) {
    if (!p.primary_engineer_id) continue;
    const list = projectIdsByEngineer.get(p.primary_engineer_id) ?? [];
    list.push(p.id);
    projectIdsByEngineer.set(p.primary_engineer_id, list);
  }

  // Revenue attribution (only fetched/shown to roles with payments:view):
  // project-level via primary_engineer_id, plus standalone-booking-level
  // via staff_id — a booking already linked to a project_session is
  // excluded here too, so its revenue isn't attributed twice.
  const revenueByEngineer = new Map<string, number>();
  if (canViewFinance) {
    const allProjectIds = (projects ?? []).map((p) => p.id);
    const linkedBookingIds = new Set((sessions ?? []).map((s) => s.booking_id).filter((id): id is string => !!id));
    const standaloneBookingIdsByEngineer = new Map<string, string[]>();
    for (const [engId, list] of bookingsByEngineer.entries()) {
      standaloneBookingIdsByEngineer.set(
        engId,
        list.filter((b) => !linkedBookingIds.has(b.id)).map((b) => b.id)
      );
    }
    const allStandaloneBookingIds = Array.from(standaloneBookingIdsByEngineer.values()).flat();
    const projectIdsForQuery = allProjectIds.length > 0 ? allProjectIds : [NONE_ID];
    const bookingIdsForQuery = allStandaloneBookingIds.length > 0 ? allStandaloneBookingIds : [NONE_ID];

    const [{ data: projectPayments }, { data: bookingPayments }] = await Promise.all([
      supabase.from("payments").select("related_id, amount").eq("related_type", "project").eq("status", "completed").in("related_id", projectIdsForQuery),
      supabase.from("payments").select("related_id, amount").eq("related_type", "booking").eq("status", "completed").in("related_id", bookingIdsForQuery),
    ]);

    const revenueByProject = new Map<string, number>();
    for (const p of projectPayments ?? []) {
      revenueByProject.set(p.related_id!, (revenueByProject.get(p.related_id!) ?? 0) + p.amount);
    }
    const revenueByBooking = new Map<string, number>();
    for (const p of bookingPayments ?? []) {
      revenueByBooking.set(p.related_id!, (revenueByBooking.get(p.related_id!) ?? 0) + p.amount);
    }

    for (const engId of engineerIds) {
      let total = 0;
      for (const projectId of projectIdsByEngineer.get(engId) ?? []) total += revenueByProject.get(projectId) ?? 0;
      for (const bookingId of standaloneBookingIdsByEngineer.get(engId) ?? []) total += revenueByBooking.get(bookingId) ?? 0;
      revenueByEngineer.set(engId, total);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">Team</h1>

      {error ? (
        <p className="text-sm text-red-600">Could not load the team directory.</p>
      ) : !profiles || profiles.length === 0 ? (
        <EmptyState title="No team members yet" description="Staff accounts will show up here once they're added." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Specialties</th>
                <th className="px-4 py-2 font-medium">Hours (scheduled / completed)</th>
                <th className="px-4 py-2 font-medium">Utilization</th>
                {canViewFinance ? <th className="px-4 py-2 font-medium">Revenue</th> : null}
                {canViewFinance ? <th className="px-4 py-2 font-medium">Commission owed</th> : null}
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const isEngineer = p.role === "engineer";
                const hours = isEngineer
                  ? computeEngineerHours(sessionsByEngineer.get(p.id) ?? [], bookingsByEngineer.get(p.id) ?? [])
                  : null;
                const revenue = isEngineer ? revenueByEngineer.get(p.id) ?? 0 : null;
                const commission = isEngineer && revenue !== null ? computeCommission(revenue, p.commission_rate) : null;

                return (
                  <tr key={p.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                    <td className="px-4 py-2 font-medium text-neutral-900">
                      <Link href={`/team/${p.id}`} className="hover:underline">
                        {p.display_name || p.email || "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-neutral-600 capitalize">{p.role}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status] ?? STATUS_STYLES.active}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-neutral-600">{p.specialties && p.specialties.length > 0 ? p.specialties.join(", ") : "—"}</td>
                    <td className="px-4 py-2 text-neutral-600">
                      {hours ? `${hours.scheduledHours.toFixed(1)} / ${hours.completedHours.toFixed(1)} hrs` : "—"}
                    </td>
                    <td className="px-4 py-2 text-neutral-600">
                      {hours && hours.utilizationPercentage !== null ? `${hours.utilizationPercentage.toFixed(0)}%` : "—"}
                    </td>
                    {canViewFinance ? (
                      <td className="px-4 py-2 text-neutral-600">{revenue !== null ? `$${revenue.toFixed(2)}` : "—"}</td>
                    ) : null}
                    {canViewFinance ? (
                      <td className="px-4 py-2 text-neutral-600">
                        {commission !== null ? `$${commission.toFixed(2)}` : isEngineer ? "Not set" : "—"}
                      </td>
                    ) : null}
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
