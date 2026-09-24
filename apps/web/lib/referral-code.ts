import { randomBytes } from "node:crypto";

/** Short, URL-safe, human-typeable referral code (e.g. "7F3K9A2B"). */
export function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}
