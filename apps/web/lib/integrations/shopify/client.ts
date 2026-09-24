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

async function shopifyGraphQL<T>(creds: ShopifyCredentials, query: string): Promise<T> {
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
  if (body.errors) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(body.errors)}`);
  }
  return body.data as T;
}

type ShopVerifyResult = {
  shopName: string;
  customerSample: string[];
  orderSample: string[];
  productSample: string[];
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
    const data = await shopifyGraphQL<{
      shop: { name: string };
      customers: { edges: { node: { displayName: string } }[] };
      orders: { edges: { node: { name: string } }[] };
      products: { edges: { node: { title: string } }[] };
    }>(
      creds,
      `{
        shop { name }
        customers(first: 3) { edges { node { displayName } } }
        orders(first: 3) { edges { node { name } } }
        products(first: 3) { edges { node { title } } }
      }`
    );

    return {
      ok: true,
      shopName: data.shop.name,
      customerSample: data.customers.edges.map((e) => e.node.displayName),
      orderSample: data.orders.edges.map((e) => e.node.name),
      productSample: data.products.edges.map((e) => e.node.title),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Request failed." };
  }
}
