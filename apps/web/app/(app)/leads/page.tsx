import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { leadLabel, formatDate } from "@/lib/format";
import { sanitizeSearchTerm } from "@/lib/search";
import { EmptyState } from "@/components/empty-state";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canView = await hasPermission(profile.role, "leads", "view");
  if (!canView) {
    return <EmptyState title="No access" description="You don't have permission to view leads." />;
  }

  const canCreate = await hasPermission(profile.role, "leads", "create");
  const { q, status } = await searchParams;
  const term = q ? sanitizeSearchTerm(q) : "";

  const supabase = await createClient();

  const { data: statuses } = await supabase
    .from("lead_statuses")
    .select("slug, label, sort_order")
    .order("sort_order");

  let query = supabase
    .from("leads")
    .select("id, first_name, last_name, email, phone, status, source, service_interest, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) query = query.eq("status", status);
  if (term) {
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`
    );
  }

  const { data: leads, error } = await query;
  const statusLabel = (slug: string) => statuses?.find((s) => s.slug === slug)?.label ?? slug;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Leads</h1>
        {canCreate ? (
          <Link
            href="/leads/new"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            New lead
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form className="max-w-sm flex-1">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name, email, phone…"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          />
        </form>
        <div className="flex flex-wrap gap-1.5">
          <StatusFilterLink label="All" active={!status} href="/leads" />
          {(statuses ?? []).map((s) => (
            <StatusFilterLink key={s.slug} label={s.label} active={status === s.slug} href={`/leads?status=${s.slug}`} />
          ))}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600">Could not load leads.</p>
      ) : !leads || leads.length === 0 ? (
        <EmptyState
          title={term || status ? "No matches" : "No leads yet"}
          description={
            term || status
              ? "Try a different search or filter."
              : canCreate
                ? "Add your first lead to get started."
                : "Leads will show up here once they're added."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Contact</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Service interest</th>
                <th className="px-4 py-2 font-medium">Added</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-2">
                    <Link href={`/leads/${lead.id}`} className="font-medium text-neutral-900 hover:underline">
                      {leadLabel(lead)}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{lead.email || lead.phone || "—"}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                      {statusLabel(lead.status)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{lead.service_interest || "—"}</td>
                  <td className="px-4 py-2 text-neutral-500">{formatDate(lead.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusFilterLink({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
      }`}
    >
      {label}
    </Link>
  );
}
