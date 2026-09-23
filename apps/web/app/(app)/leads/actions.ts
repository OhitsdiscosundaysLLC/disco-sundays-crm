"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activities";
import { leadLabel } from "@/lib/format";

export type FormState = { error: string | null };

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : null;
}

function readLeadFields(formData: FormData) {
  return {
    first_name: str(formData, "first_name"),
    last_name: str(formData, "last_name"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    status: str(formData, "status") ?? "new",
    source: str(formData, "source"),
    assigned_staff: str(formData, "assigned_staff"),
    service_interest: str(formData, "service_interest"),
    notes: str(formData, "notes"),
  };
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createLead(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "leads", "create");
  if (!allowed) return { error: "You don't have permission to create leads." };

  const fields = readLeadFields(formData);
  if (!fields.first_name && !fields.last_name && !fields.email && !fields.phone) {
    return { error: "Enter at least a name, email, or phone." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").insert(fields).select("id").single();

  if (error) {
    console.error("createLead failed", error);
    return { error: "Could not create the lead. Try again." };
  }

  revalidatePath("/leads");
  redirect(`/leads/${data.id}`);
}

export async function updateLead(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const id = str(formData, "id");
  if (!id) return { error: "Missing lead id." };

  const allowed = await hasPermission(profile.role, "leads", "edit");
  if (!allowed) return { error: "You don't have permission to edit leads." };

  const fields = readLeadFields(formData);
  if (!fields.first_name && !fields.last_name && !fields.email && !fields.phone) {
    return { error: "Enter at least a name, email, or phone." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("leads").update(fields).eq("id", id);

  if (error) {
    console.error("updateLead failed", error);
    return { error: "Could not save changes. Try again." };
  }

  revalidatePath(`/leads/${id}`);
  redirect(`/leads/${id}`);
}

export async function deleteLead(id: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "leads", "delete");
  if (!allowed) redirectWithError(`/leads/${id}`, "You don't have permission to delete leads.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("deleteLead failed", error);
    redirectWithError(`/leads/${id}`, "Could not delete this lead.");
  }

  revalidatePath("/leads");
  redirect("/leads");
}

/**
 * Converts a lead into a customer. Dedup follows docs/DATABASE.md's ordered
 * match (docs/DECISIONS.md D-009): email first, then phone, else create a
 * new customer — never a fuzzy/automatic merge.
 */
export async function convertLead(leadId: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [canEditLeads, canCreateCustomers] = await Promise.all([
    hasPermission(profile.role, "leads", "edit"),
    hasPermission(profile.role, "customers", "create"),
  ]);

  if (!canEditLeads || !canCreateCustomers) {
    redirectWithError(`/leads/${leadId}`, "You don't have permission to convert leads.");
  }

  const supabase = await createClient();
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    redirectWithError("/leads", "Lead not found.");
  }

  if (lead.converted_customer_id) {
    redirect(`/customers/${lead.converted_customer_id}`);
  }

  let customerId: string | null = null;

  if (lead.email) {
    const { data: match } = await supabase
      .from("customers")
      .select("id")
      .eq("email", lead.email)
      .is("deleted_at", null)
      .maybeSingle();
    customerId = match?.id ?? null;
  }

  if (!customerId && lead.phone) {
    const { data: match } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", lead.phone)
      .is("deleted_at", null)
      .maybeSingle();
    customerId = match?.id ?? null;
  }

  const label = leadLabel(lead);

  if (!customerId) {
    const display_name = label !== "Unnamed lead" ? label : null;
    const { data: created, error: createError } = await supabase
      .from("customers")
      .insert({
        first_name: lead.first_name,
        last_name: lead.last_name,
        display_name,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        referral_source: lead.source,
      })
      .select("id")
      .single();

    if (createError || !created) {
      console.error("convertLead: customer creation failed", createError);
      redirectWithError(`/leads/${leadId}`, "Could not create a customer from this lead.");
    }

    customerId = created.id;

    await logActivity(supabase, {
      customerId,
      type: "lead.converted",
      title: `Converted from lead: ${label}`,
    });
  } else {
    await logActivity(supabase, {
      customerId,
      type: "lead.converted",
      title: `Matched existing customer from lead: ${label}`,
    });
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update({ converted_customer_id: customerId, status: "won" })
    .eq("id", leadId);

  if (updateError) {
    console.error("convertLead: lead update failed", updateError);
  }

  revalidatePath("/leads");
  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}`);
}
