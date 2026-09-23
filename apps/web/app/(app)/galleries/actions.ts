"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { hashGalleryPassword } from "@/lib/gallery-password";
import { logActivity } from "@/lib/activities";
import type { TablesUpdate } from "@/lib/supabase/database.types";

export type FormState = { error: string | null };

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : null;
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const suffix = randomBytes(3).toString("hex");
  return `${base || "gallery"}-${suffix}`;
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createGallery(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "galleries", "create");
  if (!allowed) return { error: "You don't have permission to create galleries." };

  const customer_id = str(formData, "customer_id");
  const project_id = str(formData, "project_id");
  const title = str(formData, "title");
  const description = str(formData, "description");
  const visibility = str(formData, "visibility") ?? "private";
  const password = str(formData, "password");
  const expires_at = str(formData, "expires_at");
  const allow_downloads = formData.get("allow_downloads") === "on";

  if (!customer_id) return { error: "Select a customer." };
  if (!title) return { error: "Enter a gallery title." };
  if (visibility === "private" && !password) {
    return { error: "Private galleries need a password (or switch to public)." };
  }

  const supabase = await createClient();
  let slug = slugify(title);

  let attempt = 0;
  while (attempt < 3) {
    const { data, error } = await supabase
      .from("galleries")
      .insert({
        customer_id,
        project_id,
        title,
        description,
        slug,
        visibility,
        password_hash: password ? hashGalleryPassword(password) : null,
        expires_at,
        allow_downloads,
      })
      .select("id")
      .single();

    if (!error) {
      await logActivity(supabase, {
        customerId: customer_id,
        type: "gallery.created",
        title: `Gallery "${title}" created`,
      });
      revalidatePath("/galleries");
      redirect(`/galleries/${data.id}`);
    }

    if (error.code === "23505") {
      slug = slugify(title);
      attempt += 1;
      continue;
    }

    console.error("createGallery failed", error);
    return { error: "Could not create the gallery. Try again." };
  }

  return { error: "Could not generate a unique link. Try again." };
}

export async function updateGallerySettings(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const id = str(formData, "id");
  if (!id) return { error: "Missing gallery id." };

  const allowed = await hasPermission(profile.role, "galleries", "edit");
  if (!allowed) return { error: "You don't have permission to edit galleries." };

  const project_id = str(formData, "project_id");
  const title = str(formData, "title");
  const description = str(formData, "description");
  const visibility = str(formData, "visibility") ?? "private";
  const password = str(formData, "password");
  const expires_at = str(formData, "expires_at");
  const allow_downloads = formData.get("allow_downloads") === "on";

  if (!title) return { error: "Enter a gallery title." };

  const update: TablesUpdate<"galleries"> = {
    project_id,
    title,
    description,
    visibility,
    expires_at,
    allow_downloads,
  };
  // Blank password field = leave the existing password unchanged.
  if (password) update.password_hash = hashGalleryPassword(password);

  const supabase = await createClient();
  const { error } = await supabase.from("galleries").update(update).eq("id", id);

  if (error) {
    console.error("updateGallerySettings failed", error);
    return { error: "Could not save changes. Try again." };
  }

  revalidatePath(`/galleries/${id}`);
  redirect(`/galleries/${id}`);
}

export async function togglePublish(id: string, nextPublished: boolean) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "galleries", "edit");
  if (!allowed) redirectWithError(`/galleries/${id}`, "You don't have permission to publish galleries.");

  const supabase = await createClient();
  const { data: gallery } = await supabase.from("galleries").select("customer_id, title").eq("id", id).single();

  const { error } = await supabase.from("galleries").update({ published: nextPublished }).eq("id", id);

  if (error) {
    console.error("togglePublish failed", error);
    redirectWithError(`/galleries/${id}`, "Could not update publish status.");
  }

  if (gallery) {
    await logActivity(supabase, {
      customerId: gallery.customer_id,
      type: nextPublished ? "gallery.published" : "gallery.unpublished",
      title: nextPublished ? `Gallery "${gallery.title}" published` : `Gallery "${gallery.title}" unpublished`,
    });
  }

  revalidatePath(`/galleries/${id}`);
}

export async function archiveGallery(id: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "galleries", "delete");
  if (!allowed) redirect("/galleries");

  const supabase = await createClient();
  const { error } = await supabase
    .from("galleries")
    .update({ deleted_at: new Date().toISOString(), published: false })
    .eq("id", id);

  if (error) console.error("archiveGallery failed", error);

  revalidatePath("/galleries");
  redirect("/galleries");
}

export async function addGalleryAsset(
  galleryId: string,
  storagePath: string,
  kind: "image" | "video"
) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "galleries", "edit");
  if (!allowed) redirectWithError(`/galleries/${galleryId}`, "You don't have permission to add assets.");

  const supabase = await createClient();
  const { error } = await supabase.from("gallery_assets").insert({
    gallery_id: galleryId,
    storage_path: storagePath,
    kind,
  });

  if (error) {
    console.error("addGalleryAsset failed", error);
    redirectWithError(`/galleries/${galleryId}`, "Upload succeeded but saving the asset record failed.");
  }

  revalidatePath(`/galleries/${galleryId}`);
}

export async function deleteGalleryAsset(
  galleryId: string,
  assetId: string,
  storagePath: string,
  bucket: string
) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "galleries", "delete");
  if (!allowed) redirectWithError(`/galleries/${galleryId}`, "You don't have permission to remove assets.");

  const supabase = await createClient();
  await supabase.storage.from(bucket).remove([storagePath]);

  const { error } = await supabase.from("gallery_assets").delete().eq("id", assetId);

  if (error) {
    console.error("deleteGalleryAsset failed", error);
    redirectWithError(`/galleries/${galleryId}`, "Could not remove the asset.");
  }

  revalidatePath(`/galleries/${galleryId}`);
}

export async function setCoverAsset(galleryId: string, assetId: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "galleries", "edit");
  if (!allowed) redirectWithError(`/galleries/${galleryId}`, "You don't have permission to edit this gallery.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("galleries")
    .update({ cover_asset_id: assetId })
    .eq("id", galleryId);

  if (error) {
    console.error("setCoverAsset failed", error);
    redirectWithError(`/galleries/${galleryId}`, "Could not set the cover image.");
  }

  revalidatePath(`/galleries/${galleryId}`);
}
