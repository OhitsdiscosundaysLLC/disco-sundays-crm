import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { getShopifyCredentials, shopifyGraphQL, type ShopifyCredentials } from "./client";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Pull-based read sync: Shopify remains the source of truth (D-011,
 * D-032) for its own customers/orders/products. This only ever reads
 * from Shopify and writes into the CRM's own tables, matching customers
 * per the same rules already proven for Square (D-023): external ID ->
 * email -> phone -> create new, never fuzzy auto-merge. Runs under the
 * service-role client for the same reason as Square's sync — payments
 * has no authenticated-user write policy by design; the caller (a
 * permission-gated server action) is what decides who may trigger a run.
 *
 * Every sync function accepts an optional `limit` — the total number of
 * records to process, not a page size. Passing a small limit (e.g. 5)
 * runs a safe, bounded test against real data without importing
 * everything; omitting it processes the full resource. See D-032/D-033.
 */

type Svc = SupabaseClient<Database>;

type ShopifyCustomerNode = {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
};

type ShopifyOrderNode = {
  id: string;
  name: string;
  customer: { id: string } | null;
  displayFinancialStatus: string | null;
  cancelledAt: string | null;
  processedAt: string | null;
  createdAt: string;
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
};

type ShopifyProductNode = {
  id: string;
  title: string;
  variants: { edges: { node: { price: string } }[] };
};

type Connection<T> = { edges: { node: T; cursor: string }[]; pageInfo: { hasNextPage: boolean } };

/**
 * Cursor-paginates a single top-level connection field, stopping once
 * `limit` total records have been collected (if provided) — mirrors
 * Square's `squarePaginate()` but for GraphQL's cursor model instead of
 * Square's opaque page cursor.
 */
async function shopifyPaginate<T>(
  creds: ShopifyCredentials,
  buildQuery: (pageSize: number, after: string | null) => string,
  extractConnection: (data: Record<string, unknown>) => Connection<T>,
  limit?: number
): Promise<T[]> {
  const results: T[] = [];
  let cursor: string | null = null;
  const pageSize = 50;

  do {
    const remaining = limit !== undefined ? limit - results.length : pageSize;
    if (limit !== undefined && remaining <= 0) break;
    const size = Math.min(pageSize, limit !== undefined ? remaining : pageSize);

    const { data, errors } = await shopifyGraphQL<Record<string, unknown>>(creds, buildQuery(size, cursor));
    if (!data) {
      const detail = errors.map((e) => `${e.path?.join(".") ?? "?"}: ${e.extensions?.code ?? e.message}`).join("; ");
      throw new Error(detail || "Shopify request returned no data.");
    }

    const connection = extractConnection(data);
    results.push(...connection.edges.map((e) => e.node));
    cursor = connection.edges.length > 0 ? connection.edges[connection.edges.length - 1].cursor : null;
    if (!connection.pageInfo.hasNextPage) cursor = null;
  } while (cursor && (limit === undefined || results.length < limit));

  return results;
}

function afterClause(after: string | null): string {
  return after ? `, after: ${JSON.stringify(after)}` : "";
}

/** Matches or creates a CRM customer per docs/DATABASE.md customer-matching rules — same 3-tier rule and race-condition hardening as Square's matchOrCreateCustomer (D-023). */
async function matchOrCreateShopifyCustomer(
  supabase: Svc,
  sc: ShopifyCustomerNode
): Promise<{ id: string; outcome: "matched" | "updated" | "created" }> {
  const { data: byExternalId } = await supabase
    .from("customers")
    .select("id")
    .eq("shopify_customer_id", sc.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (byExternalId) return { id: byExternalId.id, outcome: "matched" };

  if (sc.email) {
    const { data: byEmail } = await supabase
      .from("customers")
      .select("id, shopify_customer_id")
      .eq("email", sc.email)
      .is("deleted_at", null)
      .maybeSingle();
    if (byEmail) {
      if (!byEmail.shopify_customer_id) {
        await supabase.from("customers").update({ shopify_customer_id: sc.id }).eq("id", byEmail.id);
        return { id: byEmail.id, outcome: "updated" };
      }
      return { id: byEmail.id, outcome: "matched" };
    }
  }

  if (sc.phone) {
    const { data: byPhone } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", sc.phone)
      .is("deleted_at", null)
      .maybeSingle();
    if (byPhone) {
      await supabase.from("customers").update({ shopify_customer_id: sc.id }).eq("id", byPhone.id);
      return { id: byPhone.id, outcome: "updated" };
    }
  }

  const { data: created, error } = await supabase
    .from("customers")
    .insert({
      first_name: sc.firstName,
      last_name: sc.lastName,
      display_name: sc.displayName ?? ([sc.firstName, sc.lastName].filter(Boolean).join(" ") || null),
      email: sc.email,
      phone: sc.phone,
      source: "shopify",
      shopify_customer_id: sc.id,
    })
    .select("id")
    .single();

  if (error) {
    // Same race-condition/duplicate-email resilience as Square's sync —
    // a concurrent run, or Shopify itself having more than one customer
    // record sharing an email, shouldn't fail the whole sync.
    if (error.code === "23505") {
      const { data: byExternal } = await supabase
        .from("customers")
        .select("id")
        .eq("shopify_customer_id", sc.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (byExternal) return { id: byExternal.id, outcome: "matched" };

      if (sc.email) {
        const { data: byEmail } = await supabase
          .from("customers")
          .select("id")
          .eq("email", sc.email)
          .is("deleted_at", null)
          .maybeSingle();
        if (byEmail) return { id: byEmail.id, outcome: "matched" };
      }
    }
    throw new Error(`Failed to create customer for Shopify ${sc.id}: ${error.message}`);
  }
  if (!created) throw new Error(`Failed to create customer for Shopify ${sc.id}: no row returned`);
  return { id: created.id, outcome: "created" };
}

export type ShopifySyncSummary = {
  customers: { created: number; updated: number; matched: number; failed: number; total: number };
  orders: {
    created: number;
    updated: number;
    skippedNoCustomer: number;
    skippedOrderIds: string[];
    failed: number;
    total: number;
  };
  products: { created: number; updated: number; failed: number; total: number };
};

async function syncCustomers(supabase: Svc, creds: ShopifyCredentials, limit?: number) {
  const customers = await shopifyPaginate<ShopifyCustomerNode>(
    creds,
    (size, after) => `{
      customers(first: ${size}${afterClause(after)}) {
        edges {
          cursor
          node { id email phone firstName lastName displayName }
        }
        pageInfo { hasNextPage }
      }
    }`,
    (data) => data.customers as Connection<ShopifyCustomerNode>,
    limit
  );

  const summary = { created: 0, updated: 0, matched: 0, failed: 0, total: customers.length };

  for (const sc of customers) {
    try {
      const { outcome } = await matchOrCreateShopifyCustomer(supabase, sc);
      summary[outcome]++;
    } catch (err) {
      console.error("Shopify sync: customer failed", sc.id, err instanceof Error ? err.message : err);
      summary.failed++;
    }
  }

  return summary;
}

/**
 * Maps Shopify's displayFinancialStatus onto the CRM's existing
 * payments.status check constraint (pending/completed/failed/refunded/
 * partially_refunded — see D-032). A cancelled order is treated as
 * failed regardless of its financial status. PARTIALLY_PAID has no
 * exact equivalent in the 5-value enum and maps to pending.
 */
function mapShopifyOrderStatus(
  displayFinancialStatus: string | null,
  cancelledAt: string | null
): "pending" | "completed" | "failed" | "refunded" | "partially_refunded" {
  if (cancelledAt) return "failed";
  switch (displayFinancialStatus) {
    case "PAID":
      return "completed";
    case "REFUNDED":
      return "refunded";
    case "PARTIALLY_REFUNDED":
      return "partially_refunded";
    case "VOIDED":
    case "EXPIRED":
      return "failed";
    default:
      return "pending";
  }
}

async function syncOrders(supabase: Svc, creds: ShopifyCredentials, limit?: number) {
  const orders = await shopifyPaginate<ShopifyOrderNode>(
    creds,
    (size, after) => `{
      orders(first: ${size}${afterClause(after)}) {
        edges {
          cursor
          node {
            id
            name
            customer { id }
            displayFinancialStatus
            cancelledAt
            processedAt
            createdAt
            totalPriceSet { shopMoney { amount currencyCode } }
          }
        }
        pageInfo { hasNextPage }
      }
    }`,
    (data) => data.orders as Connection<ShopifyOrderNode>,
    limit
  );

  const summary = {
    created: 0,
    updated: 0,
    skippedNoCustomer: 0,
    skippedOrderIds: [] as string[],
    failed: 0,
    total: orders.length,
  };

  for (const order of orders) {
    let customerId: string | null = null;
    if (order.customer) {
      const { data } = await supabase
        .from("customers")
        .select("id")
        .eq("shopify_customer_id", order.customer.id)
        .is("deleted_at", null)
        .maybeSingle();
      customerId = data?.id ?? null;
    }

    if (!customerId) {
      summary.skippedNoCustomer++;
      summary.skippedOrderIds.push(order.name);
      continue;
    }

    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("provider", "shopify")
      .eq("provider_transaction_id", order.id)
      .maybeSingle();

    const row = {
      customer_id: customerId,
      amount: Number(order.totalPriceSet.shopMoney.amount),
      currency: order.totalPriceSet.shopMoney.currencyCode,
      provider: "shopify" as const,
      provider_transaction_id: order.id,
      status: mapShopifyOrderStatus(order.displayFinancialStatus, order.cancelledAt),
      paid_at: order.displayFinancialStatus === "PAID" ? (order.processedAt ?? order.createdAt) : null,
      related_type: "order" as const,
      related_id: null,
      metadata: { shopify_order_name: order.name },
    };

    if (existing) {
      const { error } = await supabase.from("payments").update(row).eq("id", existing.id);
      if (error) {
        console.error("Shopify sync: order update failed", order.id, error.message);
        summary.failed++;
      } else {
        summary.updated++;
      }
    } else {
      const { error } = await supabase.from("payments").insert(row);
      if (error) {
        console.error("Shopify sync: order insert failed", order.id, error.message);
        summary.failed++;
      } else {
        summary.created++;
      }
    }
  }

  return summary;
}

async function syncProducts(supabase: Svc, creds: ShopifyCredentials, limit?: number) {
  const products = await shopifyPaginate<ShopifyProductNode>(
    creds,
    (size, after) => `{
      products(first: ${size}${afterClause(after)}) {
        edges {
          cursor
          node {
            id
            title
            variants(first: 1) { edges { node { price } } }
          }
        }
        pageInfo { hasNextPage }
      }
    }`,
    (data) => data.products as Connection<ShopifyProductNode>,
    limit
  );

  const summary = { created: 0, updated: 0, failed: 0, total: products.length };

  for (const product of products) {
    const price = product.variants.edges[0]?.node.price;

    const { data: existing } = await supabase
      .from("services")
      .select("id")
      .eq("shopify_product_id", product.id)
      .maybeSingle();

    if (existing) {
      // Only touch the fields Shopify owns — never overwrite
      // external_square_service_id, duration_minutes, active, category,
      // or internal_notes, which this sync has no opinion on.
      const { error } = await supabase
        .from("services")
        .update({ name: product.title, price: price !== undefined ? Number(price) : null })
        .eq("id", existing.id);
      if (error) {
        console.error("Shopify sync: product update failed", product.id, error.message);
        summary.failed++;
      } else {
        summary.updated++;
      }
    } else {
      const { error } = await supabase.from("services").insert({
        name: product.title,
        price: price !== undefined ? Number(price) : null,
        shopify_product_id: product.id,
      });
      if (error) {
        console.error("Shopify sync: product insert failed", product.id, error.message);
        summary.failed++;
      } else {
        summary.created++;
      }
    }
  }

  return summary;
}

export type ShopifySyncResult = { ok: true; summary: ShopifySyncSummary } | { ok: false; error: string };

export type ShopifySyncOptions = {
  /** Caps the number of records processed per resource. Omit for a full sync. */
  limit?: number;
};

export async function runShopifySync(options: ShopifySyncOptions = {}): Promise<ShopifySyncResult> {
  const creds = getShopifyCredentials();
  if (!creds) return { ok: false, error: "Shopify credentials are not fully configured." };

  const supabase = createServiceClient();
  if (!supabase) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not configured." };

  try {
    const customers = await syncCustomers(supabase, creds, options.limit);
    const products = await syncProducts(supabase, creds, options.limit);
    const orders = await syncOrders(supabase, creds, options.limit);

    return { ok: true, summary: { customers, orders, products } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Shopify sync failed." };
  }
}
