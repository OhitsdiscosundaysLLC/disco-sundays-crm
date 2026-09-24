"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activities";
import { generateReferralCode } from "@/lib/referral-code";

export type FormState = { error: string | null };

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : null;
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createReferral(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "referrals", "create");
  if (!allowed) return { error: "You don't have permission to create referrals." };

  const referrer_customer_id = str(formData, "referrer_customer_id");
  const referred_customer_id = str(formData, "referred_customer_id");
  const source = str(formData, "source");
  const code = str(formData, "code");

  if (!referrer_customer_id) return { error: "Select the referrer." };
  if (!referred_customer_id) return { error: "Select the referred customer." };
  if (referrer_customer_id === referred_customer_id) {
    return { error: "A customer can't refer themselves." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("referrals")
    .insert({ referrer_customer_id, referred_customer_id, source, code })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "This customer has already been recorded as referred by someone." };
    }
    console.error("createReferral failed", error);
    return { error: "Could not create the referral. Try again." };
  }

  await logActivity(supabase, {
    customerId: referred_customer_id,
    type: "referral.created",
    title: "Referred by another customer",
  });
  await logActivity(supabase, {
    customerId: referrer_customer_id,
    type: "referral.made",
    title: "Referred a new customer",
  });

  revalidatePath("/referrals");
  redirect(`/referrals/${data.id}`);
}

export async function updateQualification(
  id: string,
  referrerCustomerId: string,
  status: "pending" | "qualified" | "rejected"
) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "referrals", "edit");
  if (!allowed) redirectWithError(`/referrals/${id}`, "You don't have permission to edit referrals.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("referrals")
    .update({ qualification_status: status })
    .eq("id", id);

  if (error) {
    console.error("updateQualification failed", error);
    redirectWithError(`/referrals/${id}`, "Could not update qualification status.");
  }

  await logActivity(supabase, {
    customerId: referrerCustomerId,
    type: "referral.status_changed",
    title: `Referral marked ${status}`,
  });

  revalidatePath(`/referrals/${id}`);
}

export async function issueReferralReward(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "rewards", "create");
  if (!allowed) return { error: "You don't have permission to issue rewards." };

  const referralId = str(formData, "referral_id");
  const customerId = str(formData, "customer_id");
  const amountRaw = str(formData, "amount");
  const reason = str(formData, "reason");

  if (!referralId || !customerId) return { error: "Missing referral." };
  const amount = amountRaw ? Number(amountRaw) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter a positive reward amount." };

  const supabase = await createClient();
  const { error } = await supabase.from("reward_transactions").insert({
    customer_id: customerId,
    type: "referral_reward",
    amount,
    reason,
    related_referral_id: referralId,
    actor_id: profile.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A reward has already been issued for this referral." };
    }
    console.error("issueReferralReward failed", error);
    return { error: "Could not issue the reward. Try again." };
  }

  await logActivity(supabase, {
    customerId,
    type: "reward.issued",
    title: `Reward issued: $${amount.toFixed(2)} (referral)`,
  });

  revalidatePath(`/referrals/${referralId}`);
  revalidatePath("/rewards");
  redirect(`/referrals/${referralId}`);
}

export async function generateCustomerReferralCode(customerId: string) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "customers", "edit");
  if (!allowed) redirectWithError(`/customers/${customerId}`, "You don't have permission to edit this customer.");

  const supabase = await createClient();

  let attempt = 0;
  while (attempt < 3) {
    const code = generateReferralCode();
    const { error } = await supabase
      .from("customers")
      .update({ referral_code: code })
      .eq("id", customerId);

    if (!error) break;
    if (error.code !== "23505") {
      console.error("generateCustomerReferralCode failed", error);
      redirectWithError(`/customers/${customerId}`, "Could not generate a referral code.");
    }
    attempt += 1;
  }

  revalidatePath(`/customers/${customerId}`);
}
