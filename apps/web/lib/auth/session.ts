import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "./types";

export type Profile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  role: UserRole;
  status: "active" | "invited" | "disabled";
  avatar_url: string | null;
};

/**
 * The signed-in user's profile, or null if not signed in. profiles RLS
 * always allows a user to read their own row (see 0001_foundation.sql),
 * so this never needs elevated access.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, email, first_name, last_name, display_name, role, status, avatar_url"
    )
    .eq("id", user.id)
    .single();

  return profile as Profile | null;
}
