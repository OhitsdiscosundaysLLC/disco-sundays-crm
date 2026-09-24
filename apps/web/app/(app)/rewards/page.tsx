import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel, formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";

export default async function RewardsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canView = await hasPermission(profile.role, "rewards", "view");
  if (!canView) {
    return <EmptyState title="No access" description="You don't have permission to view rewards." />;
  }

  const supabase = await createClient();
  const [{ data: transactions, error }, { data: accounts }] = await Promise.all([
    supabase
      .from("reward_transactions")
      .select("id, type, amount, reason, created_at, customers(id, display_name, email, phone)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("reward_accounts")
      .select("balance, customers(id, display_name, email, phone)")
      .gt("balance", 0)
      .order("balance", { ascending: false }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-neutral-900">Rewards</h1>

      <section>
        <h2 className="text-sm font-medium text-neutral-900">Balances</h2>
        {!accounts || accounts.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No reward balances yet" description="Balances appear here once rewards are issued." />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500">
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account, i) => (
                  <tr key={i} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2">
                      {account.customers ? (
                        <Link href={`/customers/${account.customers.id}`} className="font-medium text-neutral-900 hover:underline">
                          {customerLabel(account.customers)}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-neutral-700">${account.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-900">Transaction history</h2>
        {error ? (
          <p className="mt-3 text-sm text-red-600">Could not load reward transactions.</p>
        ) : !transactions || transactions.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No reward transactions yet"
              description="The ledger will show every earned, bonus, referral, and redemption transaction here."
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500">
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Reason</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2">
                      {tx.customers ? (
                        <Link href={`/customers/${tx.customers.id}`} className="text-neutral-900 hover:underline">
                          {customerLabel(tx.customers)}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-neutral-600">{tx.type}</td>
                    <td className={`px-4 py-2 ${tx.amount < 0 ? "text-red-600" : "text-green-700"}`}>
                      {tx.amount > 0 ? "+" : ""}
                      {tx.amount}
                    </td>
                    <td className="px-4 py-2 text-neutral-600">{tx.reason || "—"}</td>
                    <td className="px-4 py-2 text-neutral-500">{formatDateTime(tx.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
