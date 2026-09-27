/**
 * Shopify Dev Dashboard app auth — client-credentials grant, the current
 * model for custom apps created since Jan 2026 (no more static Admin API
 * token). Confirmed against Shopify's own docs before implementing:
 * https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens
 *
 * POST {shop}/admin/oauth/access_token, form-encoded
 * grant_type=client_credentials + client_id + client_secret -> access_token
 * (expires_in ~86399s). The token is cached in memory for this server
 * process's lifetime and re-fetched once expired — never written to the
 * database or logs.
 */

const tokenCache: { accessToken: string; expiresAt: number } = {
  accessToken: "",
  expiresAt: 0,
};

export type ShopifyCredentials = {
  storeDomain: string;
  clientId: string;
  clientSecret: string;
  apiVersion: string;
};

export function getShopifyCredentials(): ShopifyCredentials | null {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const apiVersion = process.env.SHOPIFY_API_VERSION;
  if (!storeDomain || !clientId || !clientSecret || !apiVersion) return null;
  return { storeDomain, clientId, clientSecret, apiVersion };
}

async function getAccessToken(creds: ShopifyCredentials): Promise<string> {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const res = await fetch(`https://${creds.storeDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Shopify token exchange failed: HTTP ${res.status} ${body}`.trim());
  }

  const body = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache.accessToken = body.access_token;
  // Refresh a minute early to avoid using a token that expires mid-request.
  tokenCache.expiresAt = Date.now() + Math.max(0, body.expires_in - 60) * 1000;
  return tokenCache.accessToken;
}

type ShopifyGraphQLError = { message: string; path?: string[]; extensions?: { code?: string } };

/**
 * Returns data + errors rather than throwing on any error — a field-level
 * ACCESS_DENIED (missing scope) still leaves other fields' data intact,
 * and collapsing that into a single thrown error would hide that shop
 * access works while customers/orders/products don't (see D-030: this
 * exact distinction mattered for diagnosing a real scopes issue). Only
 * throws for actual transport failures (non-2xx HTTP).
 */
async function shopifyGraphQL<T>(
  creds: ShopifyCredentials,
  query: string
): Promise<{ data: T | null; errors: ShopifyGraphQLError[] }> {
  const accessToken = await getAccessToken(creds);
  const res = await fetch(`https://${creds.storeDomain}/admin/api/${creds.apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Shopify GraphQL request failed: HTTP ${res.status} ${body}`.trim());
  }

  const body = await res.json();
  return { data: (body.data as T | undefined) ?? null, errors: body.errors ?? [] };
}

type ShopVerifyResult = {
  shopName: string;
  customerSample: string[];
  orderSample: string[];
  productSample: string[];
  /** GraphQL field names that returned ACCESS_DENIED — i.e. scopes not yet granted. */
  missingScopeFields: string[];
};

export type ShopifyConnectionCheck =
  | ({ ok: true } & ShopVerifyResult)
  | { ok: false; error: string };

/**
 * Read-only verification: authenticate, read shop info, and read a small
 * sample (3 each) of customers/orders/products — exactly what's needed to
 * prove the read_customers/read_orders/read_products scopes work, nothing
 * more. Never creates, modifies, or deletes anything in Shopify. Sample
 * data is returned for display only, never written to the CRM database —
 * actual sync is separate, later work.
 *
 * Each capability is queried *separately*, not combined into one request.
 * Shopify's root Query fields (customers/orders/products) are non-null —
 * per GraphQL's null-propagation rules, a single ACCESS_DENIED on one of
 * them nulls out the entire response's `data`, which would otherwise hide
 * that `shop` (and any other granted scope) succeeded. Confirmed by
 * direct testing against the real API — see docs/DECISIONS.md D-030.
 */
export async function checkShopifyConnection(): Promise<ShopifyConnectionCheck> {
  const creds = getShopifyCredentials();
  if (!creds) {
    return {
      ok: false,
      error: "SHOPIFY_STORE_DOMAIN / SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET / SHOPIFY_API_VERSION not fully configured.",
    };
  }

  try {
    const shopResult = await shopifyGraphQL<{ shop: { name: string } | null }>(creds, `{ shop { name } }`);
    if (!shopResult.data?.shop) {
      const detail = shopResult.errors
        .map((e) => `${e.path?.join(".") ?? "?"}: ${e.extensions?.code ?? e.message}`)
        .join("; ");
      return { ok: false, error: detail || "Shopify request returned no shop data." };
    }

    const [customersResult, ordersResult, productsResult] = await Promise.all([
      shopifyGraphQL<{ customers: { edges: { node: { displayName: string } }[] } }>(
        creds,
        `{ customers(first: 3) { edges { node { displayName } } } }`
      ),
      shopifyGraphQL<{ orders: { edges: { node: { name: string } }[] } }>(
        creds,
        `{ orders(first: 3) { edges { node { name } } } }`
      ),
      shopifyGraphQL<{ products: { edges: { node: { title: string } }[] } }>(
        creds,
        `{ products(first: 3) { edges { node { title } } } }`
      ),
    ]);

    const missingScopeFields = [
      customersResult.errors.some((e) => e.extensions?.code === "ACCESS_DENIED") ? "customers" : null,
      ordersResult.errors.some((e) => e.extensions?.code === "ACCESS_DENIED") ? "orders" : null,
      productsResult.errors.some((e) => e.extensions?.code === "ACCESS_DENIED") ? "products" : null,
    ].filter((f): f is string => Boolean(f));

    return {
      ok: true,
      shopName: shopResult.data.shop.name,
      customerSample: customersResult.data?.customers.edges.map((e) => e.node.displayName) ?? [],
      orderSample: ordersResult.data?.orders.edges.map((e) => e.node.name) ?? [],
      productSample: productsResult.data?.products.edges.map((e) => e.node.title) ?? [],
      missingScopeFields,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Request failed." };
  }
}
