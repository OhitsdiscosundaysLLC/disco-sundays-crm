"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";

export async function updateEngineerProfile(id: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "team", "edit");
  if (!allowed) return;

  const specialtiesRaw = String(formData.get("specialties") || "");
  const specialties = specialtiesRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const commissionRaw = String(formData.get("commission_rate") || "").trim();
  const commissionRate = commissionRaw.length > 0 && Number.isFinite(Number(commissionRaw)) ? Number(commissionRaw) : null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      specialties: specialties.length > 0 ? specialties : null,
      commission_rate: commissionRate,
    })
    .eq("id", id);

  if (error) console.error("updateEngineerProfile failed", error);

  revalidatePath(`/team/${id}`);
  revalidatePath("/team");
}
