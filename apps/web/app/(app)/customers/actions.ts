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

function readCustomerFields(formData: FormData) {
  return {
    first_name: str(formData, "first_name"),
    last_name: str(formData, "last_name"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    location: str(formData, "location"),
    company: str(formData, "company"),
    artist_name: str(formData, "artist_name"),
    instagram: str(formData, "instagram"),
    customer_type: str(formData, "customer_type"),
    source: str(formData, "source"),
    referral_source: str(formData, "referral_source"),
    status: str(formData, "status") ?? "active",
  };
}

/** Derived when no explicit display name is set — see docs/DATABASE.md (display_name is nullable, search/UI need a stable fallback). */
function deriveDisplayName(fields: {
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  artist_name: string | null;
  email: string | null;
}) {
  const full = [fields.first_name, fields.last_name].filter(Boolean).join(" ").trim();
  return full || fields.company || fields.artist_name || fields.email || "Unnamed customer";
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createCustomer(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "customers", "create");
  if (!allowed) return { error: "You don't have permission to create customers." };

  const fields = readCustomerFields(formData);
  if (!fields.first_name && !fields.last_name && !fields.company && !fields.email) {
    return { error: "Enter at least a name, company, or email." };
  }

  const display_name = deriveDisplayName(fields);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...fields, display_name })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "A customer with this email already exists." };
    }
    console.error("createCustomer failed", error);
    return { error: "Could not create the customer. Try again." };
  }

  await logActivity(supabase, {
    customerId: data.id,
    type: "customer.created",
    title: `${display_name} added as a customer`,
  });

  revalidatePath("/customers");
  redirect(`/customers/${data.id}`);
}

export async function updateCustomer(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const id = str(formData, "id");
  if (!id) return { error: "Missing customer id." };

  const allowed = await hasPermission(profile.role, "customers", "edit");
  if (!allowed) return { error: "You don't have permission to edit customers." };

  const fields = readCustomerFields(formData);
  if (!fields.first_name && !fields.last_name && !fields.company && !fields.email) {
    return { error: "Enter at least a name, company, or email." };
  }

  const display_name = deriveDisplayName(fields);
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ ...fields, display_name })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A customer with this email already exists." };
    }
    console.error("updateCustomer failed", error);
    return { error: "Could not save changes. Try again." };
  }

  await logActivity(supabase, {
    customerId: id,
    type: "customer.updated",
    title: `${display_name}'s profile was updated`,
  });

  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

export async function archiveCustomer(id: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "customers", "delete");
  if (!allowed) redirectWithError(`/customers/${id}`, "You don't have permission to archive customers.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ deleted_at: new Date().toISOString(), status: "archived" })
    .eq("id", id);

  if (error) {
    console.error("archiveCustomer failed", error);
    redirectWithError(`/customers/${id}`, "Could not archive this customer.");
  }

  revalidatePath("/customers");
  redirect("/customers");
}

export async function addTag(customerId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "customers", "edit");
  if (!allowed) redirectWithError(`/customers/${customerId}`, "You don't have permission to tag customers.");

  const name = str(formData, "name");
  if (!name) redirectWithError(`/customers/${customerId}`, "Enter a tag name.");

  const supabase = await createClient();

  const { data: tag, error: tagError } = await supabase
    .from("tags")
    .upsert({ name }, { onConflict: "name", ignoreDuplicates: false })
    .select("id")
    .single();

  if (tagError || !tag) {
    console.error("addTag: tag upsert failed", tagError);
    redirectWithError(`/customers/${customerId}`, "Could not create the tag.");
  }

  const { error: linkError } = await supabase
    .from("customer_tags")
    .upsert({ customer_id: customerId, tag_id: tag.id }, { onConflict: "customer_id,tag_id", ignoreDuplicates: true });

  if (linkError) {
    console.error("addTag: link failed", linkError);
    redirectWithError(`/customers/${customerId}`, "Could not add the tag.");
  }

  await logActivity(supabase, {
    customerId,
    type: "tag.added",
    title: `Tagged "${name}"`,
  });

  revalidatePath(`/customers/${customerId}`);
}

export async function removeTag(customerId: string, tagId: string, tagName: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "customers", "edit");
  if (!allowed) redirectWithError(`/customers/${customerId}`, "You don't have permission to untag customers.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_tags")
    .delete()
    .eq("customer_id", customerId)
    .eq("tag_id", tagId);

  if (error) {
    console.error("removeTag failed", error);
    redirectWithError(`/customers/${customerId}`, "Could not remove the tag.");
  }

  await logActivity(supabase, {
    customerId,
    type: "tag.removed",
    title: `Removed tag "${tagName}"`,
  });

  revalidatePath(`/customers/${customerId}`);
}

export async function addNote(customerId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "customers", "create");
  if (!allowed) redirectWithError(`/customers/${customerId}`, "You don't have permission to add notes.");

  const body = str(formData, "body");
  if (!body) redirectWithError(`/customers/${customerId}`, "Note can't be empty.");

  const supabase = await createClient();
  const { error } = await supabase.from("notes").insert({
    customer_id: customerId,
    author_id: profile.id,
    body,
  });

  if (error) {
    console.error("addNote failed", error);
    redirectWithError(`/customers/${customerId}`, "Could not save the note.");
  }

  revalidatePath(`/customers/${customerId}`);
}

export async function deleteNote(customerId: string, noteId: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase.from("notes").delete().eq("id", noteId);

  if (error) {
    console.error("deleteNote failed", error);
    redirectWithError(`/customers/${customerId}`, "Could not delete the note.");
  }

  revalidatePath(`/customers/${customerId}`);
}
