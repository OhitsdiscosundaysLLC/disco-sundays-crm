import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

/**
 * Appends a row to the customer timeline. Runs under the caller's own
 * session (never the service role) — RLS requires customers:create or
 * customers:edit, see supabase/migrations/0005_phase2_activities_write.sql.
 * Never throws: a failed timeline write shouldn't roll back or block the
 * primary action that triggered it, but it is logged server-side.
 */
export async function logActivity(
  supabase: SupabaseClient<Database>,
  params: {
    customerId: string;
    type: string;
    title: string;
    metadata?: Record<string, Json>;
  }
) {
  const { error } = await supabase.from("activities").insert({
    customer_id: params.customerId,
    type: params.type,
    title: params.title,
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.error("logActivity failed", params.type, error);
  }
}
