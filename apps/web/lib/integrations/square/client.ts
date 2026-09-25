const SQUARE_API_BASE = "https://connect.squareup.com/v2";
const SQUARE_VERSION = "2025-01-23";

export type SquareCredentials = {
  accessToken: string;
  locationId: string | null;
};

/**
 * Reads Square credentials from server-only env vars. Returns null if the
 * access token isn't configured, so callers can show an honest
 * "not connected" state rather than crashing — same pattern as
 * lib/supabase/service.ts. Never logs or returns the token itself to
 * anything that isn't this module's own fetch call.
 */
export function getSquareCredentials(): SquareCredentials | null {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken) return null;
  return { accessToken, locationId: process.env.SQUARE_LOCATION_ID ?? null };
}

export async function squareFetch(path: string, accessToken: string, init?: RequestInit) {
  return fetch(`${SQUARE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

export type SquareConnectionCheck =
  | { ok: true; locationCount: number; configuredLocationFound: boolean }
  | { ok: false; error: string };

/**
 * Read-only connectivity check (GET /v2/locations) — never creates,
 * modifies, or deletes anything in Square. Used by the Settings
 * "Test connection" action and nowhere else yet; the actual customer/
 * booking/payment sync adapters land once this is proven and the user
 * approves webhook registration.
 */
export async function checkSquareConnection(): Promise<SquareConnectionCheck> {
  const creds = getSquareCredentials();
  if (!creds) return { ok: false, error: "SQUARE_ACCESS_TOKEN is not configured." };

  try {
    const res = await squareFetch("/locations", creds.accessToken);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = Array.isArray(body.errors)
        ? body.errors.map((e: { category?: string; code?: string }) => `${e.category ?? ""}:${e.code ?? ""}`).join(", ")
        : `HTTP ${res.status}`;
      return { ok: false, error: detail || `HTTP ${res.status}` };
    }

    const body = (await res.json()) as { locations?: { id: string }[] };
    const locations = body.locations ?? [];
    const configuredLocationFound = creds.locationId
      ? locations.some((l) => l.id === creds.locationId)
      : false;

    return { ok: true, locationCount: locations.length, configuredLocationFound };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Request failed." };
  }
}
