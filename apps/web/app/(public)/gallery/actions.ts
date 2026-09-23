"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyGalleryPassword } from "@/lib/gallery-password";
import { galleryAccessCookieName, signGalleryAccess } from "@/lib/gallery-access-token";

export async function unlockGallery(slug: string, formData: FormData) {
  const service = createServiceClient();
  if (!service) redirect(`/gallery/${slug}?error=${encodeURIComponent("Gallery viewing isn't configured yet.")}`);

  const password = String(formData.get("password") || "");

  const { data: gallery } = await service
    .from("galleries")
    .select("id, password_hash")
    .eq("slug", slug)
    .eq("published", true)
    .is("deleted_at", null)
    .single();

  if (!gallery || !gallery.password_hash || !verifyGalleryPassword(password, gallery.password_hash)) {
    redirect(`/gallery/${slug}?error=${encodeURIComponent("Incorrect password.")}`);
  }

  const token = signGalleryAccess(gallery.id);
  if (token) {
    const store = await cookies();
    store.set(galleryAccessCookieName(gallery.id), token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });
  }

  redirect(`/gallery/${slug}`);
}
