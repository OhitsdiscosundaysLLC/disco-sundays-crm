import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 24 * 60 * 60 * 1000; // 24h — re-enter password daily, not every page load

/**
 * Signs a short-lived "this visitor entered the right password for this
 * gallery" token, stored in an httpOnly cookie. Reuses
 * SUPABASE_SERVICE_ROLE_KEY as HMAC key material rather than introducing a
 * new required secret — both are server-only and already gated by the same
 * "not configured yet" fallback (docs/DECISIONS.md D-015).
 */
function secret(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

export function signGalleryAccess(galleryId: string): string | null {
  const key = secret();
  if (!key) return null;

  const expiresAt = Date.now() + TTL_MS;
  const payload = `${galleryId}.${expiresAt}`;
  const mac = createHmac("sha256", key).update(payload).digest("hex");
  return `${expiresAt}.${mac}`;
}

export function verifyGalleryAccess(galleryId: string, token: string | undefined): boolean {
  const key = secret();
  if (!key || !token) return false;

  const [expiresAtRaw, mac] = token.split(".");
  const expiresAt = Number(expiresAtRaw);
  if (!expiresAt || !mac || Date.now() > expiresAt) return false;

  const payload = `${galleryId}.${expiresAt}`;
  const expected = createHmac("sha256", key).update(payload).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function galleryAccessCookieName(galleryId: string): string {
  return `gallery_access_${galleryId}`;
}
