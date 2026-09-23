import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";

/**
 * Real counts from the database — nothing here is a placeholder number.
 * Only customers/leads are counted because those are the only business
 * tables that exist so far (Phase 2). Bookings/revenue/gallery tiles get
 * added here as their own tables land in Phase 3/4, not before — see
 * docs/PROJECT_SPEC.md RULE 2.
 */
async function getCounts() {
  const supabase = await createClient();

  const [customers, leads] = await Promise.all([
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
  ]);

  return {
    customers: customers.count ?? 0,
    leads: leads.count ?? 0,
  };
}

export default async function DashboardPage() {
  const counts = await getCounts();
  const isEmpty = counts.customers === 0 && counts.leads === 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile label="Customers" value={counts.customers} />
        <StatTile label="Leads" value={counts.leads} />
      </div>

      {isEmpty ? (
        <EmptyState
          title="No activity yet"
          description="Customer and lead numbers will show up here as soon as the first records are created."
        />
      ) : null}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-neutral-900">
        {value}
      </div>
    </div>
  );
}
