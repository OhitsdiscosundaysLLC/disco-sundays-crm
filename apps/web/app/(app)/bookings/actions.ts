"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activities";

export type FormState = { error: string | null };

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : null;
}

function readBookingFields(formData: FormData) {
  return {
    customer_id: str(formData, "customer_id"),
    service_id: str(formData, "service_id"),
    date: str(formData, "date"),
    start_time: str(formData, "start_time"),
    end_time: str(formData, "end_time"),
    staff_id: str(formData, "staff_id"),
    membership_id: str(formData, "membership_id"),
    location: str(formData, "location"),
    status: str(formData, "status") ?? "pending",
    payment_status: str(formData, "payment_status") ?? "unpaid",
    notes: str(formData, "notes"),
  };
}

export async function createBooking(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "bookings", "create");
  if (!allowed) return { error: "You don't have permission to create bookings." };

  const fields = readBookingFields(formData);
  if (!fields.customer_id) return { error: "Select a customer." };
  if (!fields.service_id) return { error: "Select a service." };
  if (!fields.date) return { error: "Select a date." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .insert({
      customer_id: fields.customer_id,
      service_id: fields.service_id,
      date: fields.date,
      start_time: fields.start_time,
      end_time: fields.end_time,
      staff_id: fields.staff_id,
      membership_id: fields.membership_id,
      location: fields.location,
      status: fields.status,
      payment_status: fields.payment_status,
      notes: fields.notes,
    })
    .select("id")
    .single();

  if (error) {
    console.error("createBooking failed", error);
    return { error: "Could not create the booking. Try again." };
  }

  await logActivity(supabase, {
    customerId: fields.customer_id,
    type: "booking.created",
    title: `Booking created for ${fields.date}`,
  });

  revalidatePath("/bookings");
  redirect("/bookings");
}

export async function updateBooking(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const id = str(formData, "id");
  if (!id) return { error: "Missing booking id." };

  const allowed = await hasPermission(profile.role, "bookings", "edit");
  if (!allowed) return { error: "You don't have permission to edit bookings." };

  const fields = readBookingFields(formData);
  if (!fields.customer_id) return { error: "Select a customer." };
  if (!fields.service_id) return { error: "Select a service." };
  if (!fields.date) return { error: "Select a date." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({
      customer_id: fields.customer_id,
      service_id: fields.service_id,
      date: fields.date,
      start_time: fields.start_time,
      end_time: fields.end_time,
      staff_id: fields.staff_id,
      membership_id: fields.membership_id,
      location: fields.location,
      status: fields.status,
      payment_status: fields.payment_status,
      notes: fields.notes,
    })
    .eq("id", id);

  if (error) {
    console.error("updateBooking failed", error);
    return { error: "Could not save changes. Try again." };
  }

  await logActivity(supabase, {
    customerId: fields.customer_id,
    type: "booking.updated",
    title: `Booking for ${fields.date} updated`,
  });

  revalidatePath("/bookings");
  redirect("/bookings");
}

export async function cancelBooking(id: string, customerId: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "bookings", "delete");
  if (!allowed) redirect("/bookings");

  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({ deleted_at: new Date().toISOString(), status: "cancelled" })
    .eq("id", id);

  if (error) {
    console.error("cancelBooking failed", error);
  } else {
    await logActivity(supabase, {
      customerId,
      type: "booking.cancelled",
      title: "Booking cancelled",
    });
  }

  revalidatePath("/bookings");
}
