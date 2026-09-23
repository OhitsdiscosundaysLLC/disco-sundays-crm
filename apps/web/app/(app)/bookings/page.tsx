import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel, formatDate } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { cancelBooking } from "./actions";

export default async function BookingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canView = await hasPermission(profile.role, "bookings", "view");
  if (!canView) {
    return <EmptyState title="No access" description="You don't have permission to view bookings." />;
  }

  const [canCreate, canEdit, canDelete] = await Promise.all([
    hasPermission(profile.role, "bookings", "create"),
    hasPermission(profile.role, "bookings", "edit"),
    hasPermission(profile.role, "bookings", "delete"),
  ]);

  const supabase = await createClient();
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(
      "id, date, start_time, status, payment_status, customers(id, display_name, email, phone), services(name)"
    )
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Bookings</h1>
        {canCreate ? (
          <Link
            href="/bookings/new"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            New booking
          </Link>
        ) : null}
      </div>

      <p className="text-sm text-neutral-500">
        Square sync is not connected yet — bookings here are entered directly in the CRM. See{" "}
        <Link href="/settings" className="underline">
          Settings
        </Link>{" "}
        for integration status.
      </p>

      {error ? (
        <p className="text-sm text-red-600">Could not load bookings.</p>
      ) : !bookings || bookings.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          description={
            canCreate
              ? "Add a booking to get started."
              : "Bookings will show up here once they're added."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Service</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Payment</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-2 text-neutral-900">
                    {formatDate(booking.date)}
                    {booking.start_time ? ` · ${booking.start_time.slice(0, 5)}` : ""}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">
                    {booking.customers ? customerLabel(booking.customers) : "—"}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{booking.services?.name || "—"}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                      {booking.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{booking.payment_status}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-3">
                      {canEdit ? (
                        <Link href={`/bookings/${booking.id}/edit`} className="text-neutral-500 hover:text-neutral-900">
                          Edit
                        </Link>
                      ) : null}
                      {canDelete && booking.customers ? (
                        <form action={cancelBooking.bind(null, booking.id, booking.customers.id)}>
                          <SubmitButton pendingLabel="…" className="text-neutral-500 hover:text-red-600">
                            Cancel
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
