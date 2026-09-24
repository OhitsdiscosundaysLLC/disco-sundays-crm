import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel } from "@/lib/format";
import { BookingForm } from "../../booking-form";
import { updateBooking } from "../../actions";

export default async function EditBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "bookings", "edit");
  if (!allowed) redirect("/bookings");

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: booking }, { data: customers }, { data: services }, { data: staff }, { data: statuses }, { data: memberships }] =
    await Promise.all([
      supabase
        .from("bookings")
        .select("id, customer_id, service_id, date, start_time, end_time, staff_id, membership_id, location, status, payment_status, notes")
        .eq("id", id)
        .is("deleted_at", null)
        .single(),
      supabase
        .from("customers")
        .select("id, display_name, email, phone")
        .is("deleted_at", null)
        .order("display_name")
        .limit(200),
      supabase.from("services").select("id, name").is("deleted_at", null).order("name"),
      supabase.from("profiles").select("id, display_name, email").order("display_name"),
      supabase.from("booking_statuses").select("slug, label").order("sort_order"),
      supabase
        .from("memberships")
        .select("id, customers(display_name, email, phone), membership_plans(name)")
        .is("deleted_at", null)
        .eq("status", "active"),
    ]);

  if (!booking) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">Edit booking</h1>
      <BookingForm
        action={updateBooking}
        submitLabel="Save changes"
        customerOptions={(customers ?? []).map((c) => ({ value: c.id, label: customerLabel(c) }))}
        serviceOptions={(services ?? []).map((s) => ({ value: s.id, label: s.name }))}
        staffOptions={(staff ?? []).map((p) => ({ value: p.id, label: p.display_name || p.email || p.id }))}
        statusOptions={(statuses ?? []).map((s) => ({ value: s.slug, label: s.label }))}
        membershipOptions={(memberships ?? []).map((m) => ({
          value: m.id,
          label: `${m.customers ? customerLabel(m.customers) : "—"} — ${m.membership_plans?.name || "plan"}`,
        }))}
        defaults={booking}
      />
    </div>
  );
}
