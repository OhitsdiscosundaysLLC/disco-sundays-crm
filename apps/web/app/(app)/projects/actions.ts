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

function readProjectFields(formData: FormData) {
  return {
    customer_id: str(formData, "customer_id"),
    service_id: str(formData, "service_id"),
    name: str(formData, "name") ?? "",
    status: str(formData, "status") ?? "planning",
    start_date: str(formData, "start_date"),
    due_date: str(formData, "due_date"),
    completion_date: str(formData, "completion_date"),
    notes: str(formData, "notes"),
  };
}

export async function createProject(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "create");
  if (!allowed) return { error: "You don't have permission to create projects." };

  const fields = readProjectFields(formData);
  if (!fields.customer_id) return { error: "Select a customer." };
  if (!fields.name) return { error: "Enter a project name." };
  const customer_id = fields.customer_id;

  const supabase = await createClient();
  const { error } = await supabase.from("projects").insert({ ...fields, customer_id });

  if (error) {
    console.error("createProject failed", error);
    return { error: "Could not create the project. Try again." };
  }

  await logActivity(supabase, {
    customerId: customer_id,
    type: "project.created",
    title: `Project "${fields.name}" created`,
  });

  revalidatePath("/projects");
  redirect("/projects");
}

export async function updateProject(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const id = str(formData, "id");
  if (!id) return { error: "Missing project id." };

  const allowed = await hasPermission(profile.role, "projects", "edit");
  if (!allowed) return { error: "You don't have permission to edit projects." };

  const fields = readProjectFields(formData);
  if (!fields.customer_id) return { error: "Select a customer." };
  if (!fields.name) return { error: "Enter a project name." };
  const customer_id = fields.customer_id;

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ ...fields, customer_id })
    .eq("id", id);

  if (error) {
    console.error("updateProject failed", error);
    return { error: "Could not save changes. Try again." };
  }

  revalidatePath("/projects");
  redirect("/projects");
}

export async function archiveProject(id: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "projects", "delete");
  if (!allowed) redirect("/projects");

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) console.error("archiveProject failed", error);

  revalidatePath("/projects");
}
