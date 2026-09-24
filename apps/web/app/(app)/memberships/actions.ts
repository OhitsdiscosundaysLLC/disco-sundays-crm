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

function num(formData: FormData, key: string): number | null {
  const v = str(formData, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

// ---------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------

function readPlanFields(formData: FormData) {
  return {
    name: str(formData, "name") ?? "",
    price: num(formData, "price"),
    billing_interval: str(formData, "billing_interval") ?? "monthly",
    active: formData.get("active") === "on",
  };
}

export async function createPlan(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "memberships", "create");
  if (!allowed) return { error: "You don't have permission to create plans." };

  const fields = readPlanFields(formData);
  if (!fields.name) return { error: "Enter a plan name." };

  const supabase = await createClient();
  const { error } = await supabase.from("membership_plans").insert(fields);

  if (error) {
    console.error("createPlan failed", error);
    return { error: "Could not create the plan. Try again." };
  }

  revalidatePath("/memberships/plans");
  redirect("/memberships/plans");
}

export async function updatePlan(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const id = str(formData, "id");
  if (!id) return { error: "Missing plan id." };

  const allowed = await hasPermission(profile.role, "memberships", "edit");
  if (!allowed) return { error: "You don't have permission to edit plans." };

  const fields = readPlanFields(formData);
  if (!fields.name) return { error: "Enter a plan name." };

  const supabase = await createClient();
  const { error } = await supabase.from("membership_plans").update(fields).eq("id", id);

  if (error) {
    console.error("updatePlan failed", error);
    return { error: "Could not save changes. Try again." };
  }

  revalidatePath("/memberships/plans");
  redirect("/memberships/plans");
}

export async function archivePlan(id: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "memberships", "delete");
  if (!allowed) redirect("/memberships/plans");

  const supabase = await createClient();
  const { error } = await supabase
    .from("membership_plans")
    .update({ deleted_at: new Date().toISOString(), active: false })
    .eq("id", id);

  if (error) console.error("archivePlan failed", error);

  revalidatePath("/memberships/plans");
}

// ---------------------------------------------------------------------
// Memberships
// ---------------------------------------------------------------------

function readMembershipFields(formData: FormData) {
  return {
    customer_id: str(formData, "customer_id"),
    plan_id: str(formData, "plan_id"),
    status: str(formData, "status") ?? "active",
    start_date: str(formData, "start_date"),
    renewal_date: str(formData, "renewal_date"),
    payment_provider: str(formData, "payment_provider"),
    external_payment_id: str(formData, "external_payment_id"),
    notes: str(formData, "notes"),
  };
}

export async function createMembership(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "memberships", "create");
  if (!allowed) return { error: "You don't have permission to create memberships." };

  const fields = readMembershipFields(formData);
  if (!fields.customer_id) return { error: "Select a customer." };
  if (!fields.plan_id) return { error: "Select a plan." };
  const customer_id = fields.customer_id;
  const plan_id = fields.plan_id;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .insert({ ...fields, customer_id, plan_id, start_date: fields.start_date ?? undefined })
    .select("id")
    .single();

  if (error) {
    console.error("createMembership failed", error);
    return { error: "Could not create the membership. Try again." };
  }

  await logActivity(supabase, {
    customerId: customer_id,
    type: "membership.created",
    title: "Membership started",
  });

  revalidatePath("/memberships");
  redirect(`/memberships/${data.id}`);
}

export async function updateMembership(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const id = str(formData, "id");
  if (!id) return { error: "Missing membership id." };

  const allowed = await hasPermission(profile.role, "memberships", "edit");
  if (!allowed) return { error: "You don't have permission to edit memberships." };

  const fields = readMembershipFields(formData);
  if (!fields.customer_id) return { error: "Select a customer." };
  if (!fields.plan_id) return { error: "Select a plan." };
  const customer_id = fields.customer_id;
  const plan_id = fields.plan_id;

  const supabase = await createClient();
  const { data: before } = await supabase.from("memberships").select("status").eq("id", id).single();

  const { error } = await supabase
    .from("memberships")
    .update({ ...fields, customer_id, plan_id, start_date: fields.start_date ?? undefined })
    .eq("id", id);

  if (error) {
    console.error("updateMembership failed", error);
    return { error: "Could not save changes. Try again." };
  }

  if (before && before.status !== fields.status) {
    await logActivity(supabase, {
      customerId: customer_id,
      type: "membership.status_changed",
      title: `Membership status changed to ${fields.status}`,
    });
  }

  revalidatePath(`/memberships/${id}`);
  redirect(`/memberships/${id}`);
}

export async function cancelMembership(id: string, customerId: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "memberships", "delete");
  if (!allowed) redirectWithError(`/memberships/${id}`, "You don't have permission to cancel memberships.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .update({ status: "cancelled", deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("cancelMembership failed", error);
    redirectWithError(`/memberships/${id}`, "Could not cancel this membership.");
  }

  await logActivity(supabase, {
    customerId,
    type: "membership.cancelled",
    title: "Membership cancelled",
  });

  revalidatePath("/memberships");
  redirect("/memberships");
}
