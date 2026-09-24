import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel, formatDate } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { cancelMembership } from "../actions";

export default async function MembershipDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canView = await hasPermission(profile.role, "memberships", "view");
  if (!canView) redirect("/memberships");

  const [canEdit, canDelete] = await Promise.all([
    hasPermission(profile.role, "memberships", "edit"),
    hasPermission(profile.role, "memberships", "delete"),
  ]);

  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: membership }, { data: usageBookings }] = await Promise.all([
    supabase
      .from("memberships")
      .select("*, customers(id, display_name, email, phone), membership_plans(name, billing_interval, price)")
      .eq("id", id)
      .single(),
    supabase
      .from("bookings")
      .select("id, date, status, services(name)")
      .eq("membership_id", id)
      .is("deleted_at", null)
      .order("date", { ascending: false }),
  ]);

  if (!membership || membership.deleted_at) notFound();

  const completedCount = (usageBookings ?? []).filter((b) => b.status === "completed").length;

  return (
    <div className="max-w-2xl space-y-8">
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            {membership.customers ? customerLabel(membership.customers) : "—"}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {membership.membership_plans?.name || "—"} · {membership.status} · started{" "}
            {formatDate(membership.start_date)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {canEdit ? (
            <Link
              href={`/memberships/${membership.id}/edit`}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              Edit
            </Link>
          ) : null}
          {canDelete && membership.status !== "cancelled" ? (
            <form action={cancelMembership.bind(null, membership.id, membership.customer_id)}>
              <SubmitButton
                pendingLabel="…"
                className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
              >
                Cancel
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </div>

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-900">Details</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Plan" value={membership.membership_plans?.name} />
          <Row
            label="Price"
            value={membership.membership_plans?.price != null ? `$${membership.membership_plans.price}` : null}
          />
          <Row label="Billing" value={membership.membership_plans?.billing_interval} />
          <Row label="Renewal date" value={formatDate(membership.renewal_date)} />
          <Row label="Payment provider" value={membership.payment_provider} />
          <Row label="External payment ID" value={membership.external_payment_id} />
          <Row label="Notes" value={membership.notes} />
        </dl>
      </section>

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-900">Usage</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Computed live from bookings attributed to this membership — never hand-entered.
        </p>
        {!usageBookings || usageBookings.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No usage yet"
              description="Attribute a booking to this membership (from the booking's edit form) to track usage here."
            />
          </div>
        ) : (
          <>
            <p className="mt-3 text-sm text-neutral-700">
              {completedCount} completed booking{completedCount === 1 ? "" : "s"} · {usageBookings.length} total
            </p>
            <ul className="mt-3 space-y-2">
              {usageBookings.map((booking) => (
                <li key={booking.id} className="flex justify-between border-t border-neutral-100 pt-2 text-sm first:border-0 first:pt-0">
                  <span className="text-neutral-700">{booking.services?.name || "—"}</span>
                  <span className="text-neutral-500">
                    {formatDate(booking.date)} · {booking.status}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-100 pb-2 last:border-0">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right text-neutral-900">{value ?? "—"}</dd>
    </div>
  );
}
