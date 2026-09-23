import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel, formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";

export default async function PaymentsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canView = await hasPermission(profile.role, "payments", "view");
  if (!canView) {
    return <EmptyState title="No access" description="You don't have permission to view payments." />;
  }

  const supabase = await createClient();
  const { data: payments, error } = await supabase
    .from("payments")
    .select("id, amount, currency, provider, status, paid_at, customers(display_name, email, phone)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">Payments</h1>

      <p className="text-sm text-neutral-500">
        Payments are synced from Square and Shopify — the CRM never creates a payment record on its
        own (docs/DECISIONS.md D-011). Neither integration is connected yet, so this list is empty
        until that sync is built.
      </p>

      {error ? (
        <p className="text-sm text-red-600">Could not load payments.</p>
      ) : !payments || payments.length === 0 ? (
        <EmptyState
          title="No payments yet"
          description="Payments will appear here automatically once Square or Shopify sync is connected."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Provider</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Paid</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2 text-neutral-900">
                    {payment.customers ? customerLabel(payment.customers) : "—"}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">
                    {payment.currency} {payment.amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{payment.provider}</td>
                  <td className="px-4 py-2 text-neutral-600">{payment.status}</td>
                  <td className="px-4 py-2 text-neutral-500">{formatDateTime(payment.paid_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
