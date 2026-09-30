"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyGalleryPassword } from "@/lib/gallery-password";
import { deliveryAccessCookieName, signDeliveryAccess, verifyDeliveryAccess } from "@/lib/delivery-access-token";

export async function unlockDelivery(slug: string, formData: FormData) {
  const service = createServiceClient();
  if (!service) redirect(`/deliver/${slug}?error=${encodeURIComponent("Delivery viewing isn't configured yet.")}`);

  const password = String(formData.get("password") || "");

  const { data: link } = await service
    .from("delivery_links")
    .select("id, password_hash")
    .eq("slug", slug)
    .is("deleted_at", null)
    .single();

  if (!link || !link.password_hash || !verifyGalleryPassword(password, link.password_hash)) {
    redirect(`/deliver/${slug}?error=${encodeURIComponent("Incorrect password.")}`);
  }

  const token = signDeliveryAccess(link.id);
  if (token) {
    const store = await cookies();
    store.set(deliveryAccessCookieName(link.id), token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });
  }

  redirect(`/deliver/${slug}`);
}

async function verifyLinkAccess(deliveryLinkId: string): Promise<boolean> {
  const store = await cookies();
  const token = store.get(deliveryAccessCookieName(deliveryLinkId))?.value;
  return verifyDeliveryAccess(deliveryLinkId, token);
}

export async function submitCustomerComment(
  deliveryLinkId: string,
  customerId: string,
  slug: string,
  formData: FormData
) {
  if (!(await verifyLinkAccess(deliveryLinkId))) return;

  const service = createServiceClient();
  if (!service) return;

  const audioVersionId = String(formData.get("audio_version_id") || "");
  const comment = String(formData.get("comment") || "").trim();
  const timestampSeconds = Number(formData.get("timestamp_seconds") || 0);
  if (!audioVersionId || !comment) return;

  // Defense in depth: the version must actually be bundled into the link
  // the visitor unlocked, not merely guessed.
  const { data: bundled } = await service
    .from("delivery_link_versions")
    .select("audio_version_id")
    .eq("delivery_link_id", deliveryLinkId)
    .eq("audio_version_id", audioVersionId)
    .single();
  if (!bundled) return;

  const { error } = await service.from("audio_comments").insert({
    audio_version_id: audioVersionId,
    timestamp_seconds: Number.isFinite(timestampSeconds) ? timestampSeconds : 0,
    comment,
    author_type: "customer",
    author_customer_id: customerId,
  });

  if (error) {
    console.error("submitCustomerComment failed", error);
    return;
  }

  await service.from("activities").insert({
    customer_id: customerId,
    type: "project.audio_feedback_received",
    title: "Customer left timestamped feedback on an audio version",
  });

  revalidatePath(`/deliver/${slug}`);
}

export async function submitCustomerApproval(
  deliveryLinkId: string,
  customerId: string,
  slug: string,
  formData: FormData
) {
  if (!(await verifyLinkAccess(deliveryLinkId))) return;

  const service = createServiceClient();
  if (!service) return;

  const audioVersionId = String(formData.get("audio_version_id") || "");
  if (!audioVersionId) return;

  const { data: bundled } = await service
    .from("delivery_link_versions")
    .select("audio_version_id")
    .eq("delivery_link_id", deliveryLinkId)
    .eq("audio_version_id", audioVersionId)
    .single();
  if (!bundled) return;

  const { error } = await service.from("audio_approvals").insert({
    audio_version_id: audioVersionId,
    customer_id: customerId,
  });

  if (error) {
    // Unique violation just means it's already approved — not a real failure.
    if (error.code !== "23505") console.error("submitCustomerApproval failed", error);
    return;
  }

  await service.from("audio_versions").update({ status: "approved" }).eq("id", audioVersionId);

  await service.from("activities").insert({
    customer_id: customerId,
    type: "project.audio_version_approved",
    title: "Customer approved an audio version",
  });

  revalidatePath(`/deliver/${slug}`);
}
