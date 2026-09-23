import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Server-side Supabase client (Server Components, Server Actions, Route
 * Handlers). Uses the anon/publishable key + the signed-in user's own
 * session cookie — every query runs under that user's RLS policies, never
 * with elevated access. The service-role key is never used here; it has no
 * place in application request handling per docs/SECURITY.md.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component that can't set cookies —
            // fine as long as middleware.ts is refreshing the session.
          }
        },
      },
    }
  );
}
