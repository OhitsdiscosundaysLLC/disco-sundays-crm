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

function readTaskFields(formData: FormData) {
  return {
    title: str(formData, "title") ?? "",
    description: str(formData, "description"),
    status: str(formData, "status") ?? "todo",
    priority: str(formData, "priority") ?? "normal",
    assignee_id: str(formData, "assignee_id"),
    due_date: str(formData, "due_date"),
    related_type: str(formData, "related_type"),
    related_id: str(formData, "related_id"),
  };
}

export async function createTask(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "tasks", "create");
  if (!allowed) return { error: "You don't have permission to create tasks." };

  const fields = readTaskFields(formData);
  if (!fields.title) return { error: "Enter a task title." };

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    ...fields,
    related_type: fields.related_id ? fields.related_type : null,
    related_id: fields.related_id,
    created_by: profile.id,
  });

  if (error) {
    console.error("createTask failed", error);
    return { error: "Could not create the task. Try again." };
  }

  if (fields.related_type === "customer" && fields.related_id) {
    await logActivity(supabase, {
      customerId: fields.related_id,
      type: "task.created",
      title: `Task created: ${fields.title}`,
    });
  }

  revalidatePath("/tasks");
  redirect("/tasks");
}

export async function updateTask(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const id = str(formData, "id");
  if (!id) return { error: "Missing task id." };

  const allowed = await hasPermission(profile.role, "tasks", "edit");
  if (!allowed) return { error: "You don't have permission to edit tasks." };

  const fields = readTaskFields(formData);
  if (!fields.title) return { error: "Enter a task title." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      ...fields,
      related_type: fields.related_id ? fields.related_type : null,
      related_id: fields.related_id,
      completed_at: fields.status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) {
    console.error("updateTask failed", error);
    return { error: "Could not save changes. Try again." };
  }

  revalidatePath("/tasks");
  redirect("/tasks");
}

export async function setTaskStatus(id: string, status: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "tasks", "edit");
  if (!allowed) redirect("/tasks");

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) console.error("setTaskStatus failed", error);

  revalidatePath("/tasks");
}

export async function deleteTask(id: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "tasks", "delete");
  if (!allowed) redirect("/tasks");

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) console.error("deleteTask failed", error);

  revalidatePath("/tasks");
}
