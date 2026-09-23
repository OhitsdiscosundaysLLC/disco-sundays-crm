"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";

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

function readServiceFields(formData: FormData) {
  return {
    name: str(formData, "name") ?? "",
    description: str(formData, "description"),
    category: str(formData, "category"),
    price: num(formData, "price"),
    duration_minutes: num(formData, "duration_minutes"),
    active: formData.get("active") === "on",
    internal_notes: str(formData, "internal_notes"),
  };
}

export async function createService(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "services", "create");
  if (!allowed) return { error: "You don't have permission to create services." };

  const fields = readServiceFields(formData);
  if (!fields.name) return { error: "Enter a service name." };

  const supabase = await createClient();
  const { error } = await supabase.from("services").insert(fields);

  if (error) {
    console.error("createService failed", error);
    return { error: "Could not create the service. Try again." };
  }

  revalidatePath("/services");
  redirect("/services");
}

export async function updateService(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const id = str(formData, "id");
  if (!id) return { error: "Missing service id." };

  const allowed = await hasPermission(profile.role, "services", "edit");
  if (!allowed) return { error: "You don't have permission to edit services." };

  const fields = readServiceFields(formData);
  if (!fields.name) return { error: "Enter a service name." };

  const supabase = await createClient();
  const { error } = await supabase.from("services").update(fields).eq("id", id);

  if (error) {
    console.error("updateService failed", error);
    return { error: "Could not save changes. Try again." };
  }

  revalidatePath("/services");
  redirect("/services");
}

export async function archiveService(id: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "services", "delete");
  if (!allowed) redirect("/services");

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ deleted_at: new Date().toISOString(), active: false })
    .eq("id", id);

  if (error) console.error("archiveService failed", error);

  revalidatePath("/services");
}
