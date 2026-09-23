import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel, formatDate } from "@/lib/format";
import { sanitizeSearchTerm } from "@/lib/search";
import { EmptyState } from "@/components/empty-state";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canView = await hasPermission(profile.role, "customers", "view");
  if (!canView) {
    return (
      <EmptyState
        title="No access"
        description="You don't have permission to view customers."
      />
    );
  }

  const canCreate = await hasPermission(profile.role, "customers", "create");
  const { q } = await searchParams;
  const term = q ? sanitizeSearchTerm(q) : "";

  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("id, display_name, email, phone, company, status, customer_type, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (term) {
    query = query.or(
      `display_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,company.ilike.%${term}%,artist_name.ilike.%${term}%`
    );
  }

  const { data: customers, error } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Customers</h1>
        {canCreate ? (
          <Link
            href="/customers/new"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            New customer
          </Link>
        ) : null}
      </div>

      <form className="max-w-sm">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search name, email, phone, company…"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
      </form>

      {error ? (
        <p className="text-sm text-red-600">Could not load customers.</p>
      ) : !customers || customers.length === 0 ? (
        <EmptyState
          title={term ? "No matches" : "No customers yet"}
          description={
            term
              ? "Try a different search term."
              : canCreate
                ? "Add your first customer to get started."
                : "Customers will show up here once they're added."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">Company</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Added</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="font-medium text-neutral-900 hover:underline"
                    >
                      {customerLabel(customer)}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{customer.email || "—"}</td>
                  <td className="px-4 py-2 text-neutral-600">{customer.phone || "—"}</td>
                  <td className="px-4 py-2 text-neutral-600">{customer.company || "—"}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={customer.status} />
                  </td>
                  <td className="px-4 py-2 text-neutral-500">{formatDate(customer.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-neutral-100 text-neutral-600",
    archived: "bg-neutral-100 text-neutral-500",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-neutral-100 text-neutral-600"}`}>
      {status}
    </span>
  );
}
