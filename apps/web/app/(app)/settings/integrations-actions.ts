"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { checkSquareConnection } from "@/lib/integrations/square/client";
import { runSquareSync } from "@/lib/integrations/square/sync";
import { checkShopifyConnection } from "@/lib/integrations/shopify/client";

export async function testSquareConnection() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "settings", "edit");
  if (!allowed) return;

  const result = await checkSquareConnection();
  const supabase = await createClient();
  const now = new Date().toISOString();

  if (result.ok) {
    await supabase
      .from("integrations")
      .update({
        status: "connected",
        last_checked_at: now,
        connected_at: now,
        metadata: {
          location_count: result.locationCount,
          configured_location_found: result.configuredLocationFound,
        },
      })
      .eq("provider", "square");
  } else {
    await supabase
      .from("integrations")
      .update({
        status: "error",
        last_checked_at: now,
        metadata: { error: result.error },
      })
      .eq("provider", "square");
  }

  revalidatePath("/settings");
}

export async function syncSquareData() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "settings", "edit");
  if (!allowed) return;

  const result = await runSquareSync();
  const supabase = await createClient();
  const now = new Date().toISOString();

  if (result.ok) {
    await supabase
      .from("integrations")
      .update({
        status: "connected",
        last_checked_at: now,
        connected_at: now,
        metadata: { last_sync: result.summary, synced_at: now },
      })
      .eq("provider", "square");

    await supabase.from("audit_logs").insert({
      actor_id: profile.id,
      action: "square_sync",
      entity_type: "integrations",
      metadata: { summary: result.summary },
    });
  } else {
    await supabase
      .from("integrations")
      .update({
        status: "error",
        last_checked_at: now,
        metadata: { error: result.error },
      })
      .eq("provider", "square");
  }

  revalidatePath("/settings");
}

export async function testShopifyConnection() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "settings", "edit");
  if (!allowed) return;

  const result = await checkShopifyConnection();
  const supabase = await createClient();
  const now = new Date().toISOString();

  if (result.ok) {
    await supabase
      .from("integrations")
      .update({
        status: "connected",
        last_checked_at: now,
        connected_at: now,
        metadata: {
          shop_name: result.shopName,
          customer_sample: result.customerSample,
          order_sample: result.orderSample,
          product_sample: result.productSample,
        },
      })
      .eq("provider", "shopify");
  } else {
    await supabase
      .from("integrations")
      .update({
        status: "error",
        last_checked_at: now,
        metadata: { error: result.error },
      })
      .eq("provider", "shopify");
  }

  revalidatePath("/settings");
}
