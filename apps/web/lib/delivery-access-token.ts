import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 24 * 60 * 60 * 1000; // 24h — re-enter password daily, not every page load

/**
 * Signs a short-lived "this visitor entered the right password for this
 * delivery link" token, stored in an httpOnly cookie. Mirrors
 * lib/gallery-access-token.ts exactly (own cookie namespace so the two
 * never collide) rather than generalizing that file, to avoid touching
 * the working gallery code path for an unrelated feature.
 */
function secret(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

export function signDeliveryAccess(deliveryLinkId: string): string | null {
  const key = secret();
  if (!key) return null;

  const expiresAt = Date.now() + TTL_MS;
  const payload = `${deliveryLinkId}.${expiresAt}`;
  const mac = createHmac("sha256", key).update(payload).digest("hex");
  return `${expiresAt}.${mac}`;
}

export function verifyDeliveryAccess(deliveryLinkId: string, token: string | undefined): boolean {
  const key = secret();
  if (!key || !token) return false;

  const [expiresAtRaw, mac] = token.split(".");
  const expiresAt = Number(expiresAtRaw);
  if (!expiresAt || !mac || Date.now() > expiresAt) return false;

  const payload = `${deliveryLinkId}.${expiresAt}`;
  const expected = createHmac("sha256", key).update(payload).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function deliveryAccessCookieName(deliveryLinkId: string): string {
  return `delivery_access_${deliveryLinkId}`;
}
