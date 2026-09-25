"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";

export type AutomationFormState = { error: string | null };

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : null;
}

export async function createAutomationRule(
  _prevState: AutomationFormState,
  formData: FormData
): Promise<AutomationFormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "settings", "edit");
  if (!allowed) return { error: "You don't have permission to manage automation." };

  const name = str(formData, "name");
  const triggerEvent = str(formData, "trigger_event");
  const title = str(formData, "title");
  if (!name) return { error: "Enter a rule name." };
  if (!triggerEvent) return { error: "Select a trigger event." };
  if (!title) return { error: "Enter the task title the rule should create." };

  const dueInDays = str(formData, "due_in_days");
  const assigneeId = str(formData, "assignee_id");
  const priority = str(formData, "priority") ?? "normal";

  const actionConfig: Record<string, string | number> = { title, priority };
  if (dueInDays) actionConfig.due_in_days = Number(dueInDays);
  if (assigneeId) actionConfig.assignee_id = assigneeId;

  const supabase = await createClient();
  const { error } = await supabase.from("automation_rules").insert({
    name,
    trigger_event: triggerEvent,
    action_type: "create_task",
    action_config: actionConfig,
    created_by: profile.id,
  });

  if (error) {
    console.error("createAutomationRule failed", error);
    return { error: "Could not create the rule. Try again." };
  }

  revalidatePath("/settings");
  return { error: null };
}

export async function toggleAutomationRule(id: string, active: boolean) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "settings", "edit");
  if (!allowed) return;

  const supabase = await createClient();
  const { error } = await supabase.from("automation_rules").update({ active }).eq("id", id);
  if (error) console.error("toggleAutomationRule failed", error);

  revalidatePath("/settings");
}

export async function deleteAutomationRule(id: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "settings", "edit");
  if (!allowed) return;

  const supabase = await createClient();
  const { error } = await supabase.from("automation_rules").delete().eq("id", id);
  if (error) console.error("deleteAutomationRule failed", error);

  revalidatePath("/settings");
}
