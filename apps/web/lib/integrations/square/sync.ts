import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { getSquareCredentials, squareFetch, type SquareCredentials } from "./client";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Pull-based read sync: Square remains the source of truth (D-011). This
 * only ever reads from Square (GET requests) and writes into the CRM's own
 * tables, matching customers per the rules in docs/DATABASE.md §"Customer
 * matching" (external ID -> email -> phone -> create new, never fuzzy
 * auto-merge). Runs under the service-role client because payments has no
 * authenticated-user write policy by design (same posture documented for a
 * future webhook handler in 0006_phase3_services_bookings_payments.sql) —
 * the caller (the "Sync now" server action) is what gates who may trigger
 * this, via has_permission(role, 'settings', 'edit').
 */

type Svc = SupabaseClient<Database>;

type SquareCustomer = {
  id: string;
  given_name?: string;
  family_name?: string;
  company_name?: string;
  email_address?: string;
  phone_number?: string;
};

type SquarePayment = {
  id: string;
  status: string;
  amount_money?: { amount: number; currency: string };
  total_money?: { amount: number; currency: string };
  created_at: string;
  customer_id?: string;
  order_id?: string;
};

type SquareRefund = {
  id: string;
  payment_id: string;
  amount_money?: { amount: number; currency: string };
  reason?: string;
  status: string;
};

type SquareBooking = {
  id: string;
  status: string;
  start_at?: string;
  customer_id?: string;
  appointment_segments?: { service_variation_id?: string; duration_minutes?: number }[];
};

async function squarePaginate<T>(
  creds: SquareCredentials,
  path: string,
  listKey: string
): Promise<T[]> {
  const results: T[] = [];
  let cursor: string | undefined;

  do {
    const sep = path.includes("?") ? "&" : "?";
    const url = cursor ? `${path}${sep}cursor=${encodeURIComponent(cursor)}` : path;
    const res = await squareFetch(url, creds.accessToken);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = Array.isArray(body.errors)
        ? body.errors
            .map((e: { category?: string; code?: string; detail?: string }) =>
              [e.category, e.code, e.detail].filter(Boolean).join(": ")
            )
            .join("; ")
        : `HTTP ${res.status}`;
      throw new Error(detail || `HTTP ${res.status}`);
    }
    const body = await res.json();
    results.push(...((body[listKey] as T[]) ?? []));
    cursor = body.cursor as string | undefined;
  } while (cursor);

  return results;
}

/** Matches or creates a CRM customer per docs/DATABASE.md customer-matching rules. */
async function matchOrCreateCustomer(
  supabase: Svc,
  sq: SquareCustomer
): Promise<{ id: string; outcome: "matched" | "updated" | "created" }> {
  const { data: byExternalId } = await supabase
    .from("customers")
    .select("id")
    .eq("external_square_customer_id", sq.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (byExternalId) return { id: byExternalId.id, outcome: "matched" };

  if (sq.email_address) {
    const { data: byEmail } = await supabase
      .from("customers")
      .select("id, external_square_customer_id")
      .eq("email", sq.email_address)
      .is("deleted_at", null)
      .maybeSingle();
    if (byEmail) {
      // Only claim the external ID if this customer isn't already linked to
      // a *different* Square customer — real Square accounts sometimes have
      // more than one customer record sharing an email; don't let the
      // second one steal the canonical link from the first.
      if (!byEmail.external_square_customer_id) {
        await supabase
          .from("customers")
          .update({ external_square_customer_id: sq.id })
          .eq("id", byEmail.id);
        return { id: byEmail.id, outcome: "updated" };
      }
      return { id: byEmail.id, outcome: "matched" };
    }
  }

  if (sq.phone_number) {
    const { data: byPhone } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", sq.phone_number)
      .is("deleted_at", null)
      .maybeSingle();
    if (byPhone) {
      await supabase
        .from("customers")
        .update({ external_square_customer_id: sq.id })
        .eq("id", byPhone.id);
      return { id: byPhone.id, outcome: "updated" };
    }
  }

  const { data: created, error } = await supabase
    .from("customers")
    .insert({
      first_name: sq.given_name ?? null,
      last_name: sq.family_name ?? null,
      display_name: [sq.given_name, sq.family_name].filter(Boolean).join(" ") || null,
      company: sq.company_name ?? null,
      email: sq.email_address ?? null,
      phone: sq.phone_number ?? null,
      source: "square",
      external_square_customer_id: sq.id,
    })
    .select("id")
    .single();

  if (error) {
    // Unique-violation means either a concurrent sync run (e.g. two "Sync
    // now" clicks) already created this customer between our lookup above
    // and this insert, or — for the email key — the real Square account
    // has more than one customer record sharing an email and a different
    // one raced us to create the CRM row first. Either way, re-fetch and
    // match rather than failing the whole run.
    if (error.code === "23505") {
      const { data: byExternal } = await supabase
        .from("customers")
        .select("id")
        .eq("external_square_customer_id", sq.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (byExternal) return { id: byExternal.id, outcome: "matched" };

      if (sq.email_address) {
        const { data: byEmail } = await supabase
          .from("customers")
          .select("id")
          .eq("email", sq.email_address)
          .is("deleted_at", null)
          .maybeSingle();
        if (byEmail) return { id: byEmail.id, outcome: "matched" };
      }
    }
    throw new Error(`Failed to create customer for Square ${sq.id}: ${error.message}`);
  }
  if (!created) throw new Error(`Failed to create customer for Square ${sq.id}: no row returned`);
  return { id: created.id, outcome: "created" };
}

export type SquareSyncSummary = {
  customers: { created: number; updated: number; matched: number; total: number };
  payments: { created: number; updated: number; skippedNoCustomer: number; failed: number; total: number };
  refunds: { created: number; skippedNoPayment: number; failed: number; total: number };
  bookings:
    | { created: number; updated: number; skippedNoCustomer: number; skippedNoService: number; failed: number; total: number }
    | { notAuthorized: true; error: string };
};

function centsToDecimal(amount: number): number {
  return Math.round(amount) / 100;
}

async function syncCustomers(supabase: Svc, creds: SquareCredentials) {
  const squareCustomers = await squarePaginate<SquareCustomer>(creds, "/customers?limit=100", "customers");
  const summary = { created: 0, updated: 0, matched: 0, total: squareCustomers.length };

  for (const sq of squareCustomers) {
    const { outcome } = await matchOrCreateCustomer(supabase, sq);
    summary[outcome === "matched" ? "matched" : outcome === "updated" ? "updated" : "created"]++;
  }

  return summary;
}

async function syncPayments(supabase: Svc, creds: SquareCredentials) {
  const path = creds.locationId
    ? `/payments?location_id=${encodeURIComponent(creds.locationId)}&limit=100`
    : "/payments?limit=100";
  const squarePayments = await squarePaginate<SquarePayment>(creds, path, "payments");
  const summary = { created: 0, updated: 0, skippedNoCustomer: 0, failed: 0, total: squarePayments.length };

  for (const sp of squarePayments) {
    let customerId: string | null = null;
    if (sp.customer_id) {
      const { data } = await supabase
        .from("customers")
        .select("id")
        .eq("external_square_customer_id", sp.customer_id)
        .is("deleted_at", null)
        .maybeSingle();
      customerId = data?.id ?? null;
    }

    if (!customerId) {
      summary.skippedNoCustomer++;
      continue;
    }

    const money = sp.total_money ?? sp.amount_money;
    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("provider", "square")
      .eq("provider_transaction_id", sp.id)
      .maybeSingle();

    const row = {
      customer_id: customerId,
      amount: centsToDecimal(money?.amount ?? 0),
      currency: money?.currency ?? "USD",
      provider: "square" as const,
      provider_transaction_id: sp.id,
      status: mapSquarePaymentStatus(sp.status),
      paid_at: sp.status === "COMPLETED" ? sp.created_at : null,
      related_type: sp.order_id ? ("order" as const) : null,
      related_id: null,
      metadata: sp.order_id ? { square_order_id: sp.order_id } : {},
    };

    if (existing) {
      const { error } = await supabase.from("payments").update(row).eq("id", existing.id);
      if (error) {
        console.error("Square sync: payment update failed", sp.id, error.message);
        summary.failed++;
      } else {
        summary.updated++;
      }
    } else {
      const { error } = await supabase.from("payments").insert(row);
      if (error) {
        console.error("Square sync: payment insert failed", sp.id, error.message);
        summary.failed++;
      } else {
        summary.created++;
      }
    }
  }

  return summary;
}

function mapSquarePaymentStatus(status: string): "pending" | "completed" | "failed" | "refunded" | "partially_refunded" {
  switch (status) {
    case "COMPLETED":
      return "completed";
    case "FAILED":
    case "CANCELED":
      return "failed";
    default:
      return "pending";
  }
}

async function syncRefunds(supabase: Svc, creds: SquareCredentials) {
  const path = creds.locationId
    ? `/refunds?location_id=${encodeURIComponent(creds.locationId)}&limit=100`
    : "/refunds?limit=100";
  const squareRefunds = await squarePaginate<SquareRefund>(creds, path, "refunds");
  const summary = { created: 0, skippedNoPayment: 0, failed: 0, total: squareRefunds.length };

  for (const sr of squareRefunds) {
    const { data: payment } = await supabase
      .from("payments")
      .select("id")
      .eq("provider", "square")
      .eq("provider_transaction_id", sr.payment_id)
      .maybeSingle();

    if (!payment) {
      summary.skippedNoPayment++;
      continue;
    }

    const { data: existing } = await supabase
      .from("refunds")
      .select("id")
      .eq("provider_refund_id", sr.id)
      .maybeSingle();
    if (existing) continue;

    const { error } = await supabase.from("refunds").insert({
      payment_id: payment.id,
      amount: centsToDecimal(sr.amount_money?.amount ?? 0),
      reason: sr.reason ?? null,
      provider_refund_id: sr.id,
    });

    if (error) {
      console.error("Square sync: refund insert failed", sr.id, error.message);
      summary.failed++;
      continue;
    }

    if (sr.status === "COMPLETED") {
      await supabase.from("payments").update({ status: "refunded" }).eq("id", payment.id);
    }

    summary.created++;
  }

  return summary;
}

/**
 * Bookings require the Square Appointments API, which not every Square
 * account has enabled. A 401/403 here means the access token's account
 * doesn't have Appointments — reported honestly rather than treated as a
 * fatal sync failure, since customers/payments sync should still succeed.
 */
async function syncBookings(supabase: Svc, creds: SquareCredentials) {
  const path = creds.locationId
    ? `/bookings?location_id=${encodeURIComponent(creds.locationId)}&limit=100`
    : "/bookings?limit=100";

  let squareBookings: SquareBooking[];
  try {
    squareBookings = await squarePaginate<SquareBooking>(creds, path, "bookings");
  } catch (err) {
    return { notAuthorized: true as const, error: err instanceof Error ? err.message : "Bookings request failed." };
  }

  const summary = { created: 0, updated: 0, skippedNoCustomer: 0, skippedNoService: 0, failed: 0, total: squareBookings.length };

  for (const sb of squareBookings) {
    let customerId: string | null = null;
    if (sb.customer_id) {
      const { data } = await supabase
        .from("customers")
        .select("id")
        .eq("external_square_customer_id", sb.customer_id)
        .is("deleted_at", null)
        .maybeSingle();
      customerId = data?.id ?? null;
    }
    if (!customerId) {
      summary.skippedNoCustomer++;
      continue;
    }

    const variationId = sb.appointment_segments?.[0]?.service_variation_id;
    let serviceId: string | null = null;
    if (variationId) {
      const { data } = await supabase
        .from("services")
        .select("id")
        .eq("external_square_service_id", variationId)
        .is("deleted_at", null)
        .maybeSingle();
      serviceId = data?.id ?? null;
    }
    if (!serviceId) {
      summary.skippedNoService++;
      continue;
    }

    const startAt = sb.start_at ? new Date(sb.start_at) : null;
    const { data: existing } = await supabase
      .from("bookings")
      .select("id")
      .eq("external_square_booking_id", sb.id)
      .maybeSingle();

    const row = {
      customer_id: customerId,
      service_id: serviceId,
      date: startAt ? startAt.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      start_time: startAt ? startAt.toISOString().slice(11, 19) : null,
      status: mapSquareBookingStatus(sb.status),
      external_square_booking_id: sb.id,
    };

    if (existing) {
      const { error } = await supabase.from("bookings").update(row).eq("id", existing.id);
      if (error) {
        console.error("Square sync: booking update failed", sb.id, error.message);
        summary.failed++;
      } else {
        summary.updated++;
      }
    } else {
      const { error } = await supabase.from("bookings").insert(row);
      if (error) {
        console.error("Square sync: booking insert failed", sb.id, error.message);
        summary.failed++;
      } else {
        summary.created++;
      }
    }
  }

  return summary;
}

function mapSquareBookingStatus(status: string): "pending" | "confirmed" | "completed" | "cancelled" | "no_show" {
  switch (status) {
    case "ACCEPTED":
      return "confirmed";
    case "CANCELLED_BY_CUSTOMER":
    case "CANCELLED_BY_SELLER":
      return "cancelled";
    case "DECLINED":
      return "cancelled";
    case "NO_SHOW":
      return "no_show";
    default:
      return "pending";
  }
}

export type SquareSyncResult = { ok: true; summary: SquareSyncSummary } | { ok: false; error: string };

export async function runSquareSync(): Promise<SquareSyncResult> {
  const creds = getSquareCredentials();
  if (!creds) return { ok: false, error: "SQUARE_ACCESS_TOKEN is not configured." };

  const supabase = createServiceClient();
  if (!supabase) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not configured." };

  try {
    const customers = await syncCustomers(supabase, creds);
    const payments = await syncPayments(supabase, creds);
    const refunds = await syncRefunds(supabase, creds);
    const bookings = await syncBookings(supabase, creds);

    return { ok: true, summary: { customers, payments, refunds, bookings } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Square sync failed." };
  }
}
