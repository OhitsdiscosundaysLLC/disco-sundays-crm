import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Service-role client — bypasses RLS entirely. Server-only, never imported
 * by client components. Used exclusively by the public gallery routes,
 * which need to read a gallery row (and verify its password/expiry rules)
 * before any customer session exists — see docs/DECISIONS.md D-015.
 *
 * Returns null when SUPABASE_SERVICE_ROLE_KEY isn't set yet, so callers can
 * show an honest "not configured" state instead of crashing. Never fetched
 * or stored until this file needed it — see docs/CLAUDE_CODE_HANDOFF.md
 * section H.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createSupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
