# Integrations

Last updated: 2026-09-25

Current state (see `docs/DECISIONS.md` D-020 through D-025 for detail):
Vercel is live in production, Square connectivity + full read-sync are
verified against real data, Shopify's client is built but not yet
credentialed, and Base44/n8n are still unstarted. The table below is the
original Phase 0 discovery snapshot — kept as a historical record, not
current state.

## Discovery findings (Phase 0)

| System | Connected right now? | Evidence |
|---|---|---|
| Shopify | **Yes**, live, via this workspace's Shopify connector | `get-shop-info` returned a real store: **Disco Sundays**, domain `discosundays.com`, plan Basic, currency USD, timezone EDT, contact `ohitsdiscosundays@gmail.com`. |
| Square | No | No Square connector/credentials available in this session. Needs `SQUARE_ACCESS_TOKEN` + `SQUARE_WEBHOOK_SIGNATURE_KEY` from the Disco Sundays Square dashboard before Phase 3's Square work can go live. |
| Base44 | No | No connector or credentials available. Needs read access (API key or export) before Phase 8 discovery can start. |
| n8n | No | No connector. Not needed until Phase 9 (workflow audit). |
| Effsight | No | Not an API integration target — it's being replaced, not synced with. |
| Supabase | **Yes** | Project `nrmdcwezgdeiwcebbdcj` ("My Project"), org "Disco Sundays CRM", region us-west-2, Postgres 17.6, status ACTIVE_HEALTHY, created 2026-09-20, currently empty (0 tables before this phase). |
| Vercel | No | 0 teams, 0 projects visible to this session's Vercel connector. Needed before Phase 1 deploy. |
| GitHub | No | Session has a repo-scoped token but no repository is configured for it. See `DECISIONS.md` D-001. |

The Shopify connection above is this **Cowork session's** MCP connector,
useful for inspecting the live store during development. The production CRM
app will have its own server-side Shopify credentials (`SHOPIFY_API_KEY`,
etc. — see `.env.example`) — the two are not the same credential and one
does not substitute for the other.

## Shopify

- Storefront stays canonical for products/orders/public pages (spec §14, §3).
- CRM syncs **in**: customers, orders, order payment status, customer
  activity. Products/services sync only where relevant to the service
  catalog.
- Mechanism: Shopify webhooks (orders/create, orders/updated, customers/
  create, customers/update, ...) → verified via HMAC (`SHOPIFY_WEBHOOK_SECRET`)
  → `webhook_events` row keyed on Shopify's event/webhook id → processed →
  matched to a customer per the matching rules in `DATABASE.md`.
- Store domain confirmed as `discosundays.com` (used for `SHOPIFY_STORE_DOMAIN`
  once the Admin API app is created in the Shopify admin — this MCP session's
  connector does not itself hand over a server-usable access token).

### Inspection findings (2026-09-24, read-only, Claude Code)

Performed at the user's explicit request before any Shopify code was
written. **Nothing exists yet**:
- No Shopify SDK or GraphQL client in `apps/web/package.json`.
- No webhook route, no sync code, no adapter module anywhere in `apps/web`.
- The only Shopify-related things in the codebase are placeholder ID
  columns already built for cross-referencing once sync exists:
  `customers.shopify_customer_id`, `services.shopify_product_id`,
  `payments.provider = 'shopify'` (check-constrained, D-011/D-014).
- No `SHOPIFY_*` variables are set in `apps/web/.env.local`.
- No Shopify webhooks are registered anywhere reachable from this project.

**Integration approach — corrected 2026-09-24 (D-021)**: the user created
the app in Shopify's **Dev Dashboard** ("Disco Sundays CRM"), which is the
current path for a single-store internal integration and uses a different
auth model than originally recommended below. Verified against Shopify's
own current docs before implementing: since January 2026, every new
Shopify custom app is created in the Dev Dashboard and issues a
**Client ID + Client Secret**, not a static Admin API token — the old
"copy an access token" flow no longer exists. The app exchanges its
Client ID/Secret for a short-lived access token via the OAuth 2.0
client-credentials grant (`POST {shop}/admin/oauth/access_token`,
form-encoded `grant_type=client_credentials`, ~24h expiry). Reference:
<https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens>.
Implemented in `apps/web/lib/integrations/shopify/client.ts` — token
exchange with in-memory caching (never persisted), plus a read-only
verification call against the **GraphQL Admin API** per the user's
explicit instruction, not the legacy REST Admin API.

**Environment variables** (names match what the user's Dev Dashboard app
actually provides, updated in both `.env.example` files):
- `SHOPIFY_STORE_DOMAIN` — the `*.myshopify.com` domain (not the storefront
  domain `discosundays.com`).
- `SHOPIFY_CLIENT_ID` — permanent, not treated as secret by Shopify but
  still kept server-only here.
- `SHOPIFY_CLIENT_SECRET` — server-only, never exposed to the browser.
- `SHOPIFY_API_VERSION` — pin explicitly (the Dev Dashboard app currently
  shows `2026-07`).
- `SHOPIFY_WEBHOOK_SECRET` — only needed once webhook subscriptions are
  actually registered (a write/config action on the live store requiring
  explicit approval first, same posture as Square webhook registration).

**Minimum API scopes** (read-only — the CRM never writes back to Shopify,
per the source-of-truth rules above): `read_customers`, `read_orders`,
`read_products`. No `write_*` scopes requested or needed.

**Manual steps remaining**: fresh Client ID/Secret were entered directly
into `apps/web/.env.local` and Vercel (2026-09-25) — resolved, not from
the earlier chat paste. All four env vars confirmed present with correct
names and a valid `*.myshopify.com` store domain. **Live authentication
still fails** with a real, specific error from Shopify's own OAuth
endpoint: `app_not_installed — The application is not installed on this
shop` (D-028). This is not a credential problem — it's that the Dev
Dashboard app has never been installed on the store. **Exact fix**: Dev
Dashboard → "Disco Sundays CRM" → Home → scroll down → **Install app** →
select `disco-sundays.myshopify.com` → **Install**. Confirmed against
Shopify's current docs (see D-028's link). Re-run "Test connection" in
Settings → Integrations afterward.

The app's placeholder App URL (`https://example.com`) should be updated
to the real production URL — production is now live at
`https://disco-sundays-crm.vercel.app` — but do not release a new app
version until the user explicitly approves that specific change (per the
user's standing instruction not to touch the Shopify app version without
approval).

**Webhooks required once the app exists**: `orders/create`, `orders/updated`
(order + payment-status sync), `customers/create`, `customers/update`
(customer sync); `products/update` optional if keeping
`services.shopify_product_id` cross-references current. Registered via
the Custom App's webhook subscriptions UI or the `webhookSubscriptionCreate`
GraphQL mutation — either way, a write action on the live store, done only
with explicit approval, not automatically by Claude Code.

**Where the credential goes**: same as every other integration in this
project — Vercel server-side environment variables for production, and
`apps/web/.env.local` (gitignored) for local dev. Never pasted into chat.

## Square

- Square stays the primary booking/payment/calendar system during migration
  (spec §12, §13).
- CRM syncs **in**: customers, bookings, payments, refunds, services.
- **Implemented (2026-09-25, D-023)**: `apps/web/lib/integrations/square/sync.ts`
  is a pull-based, on-demand sync — a "Sync now" button in Settings →
  Integrations, next to "Test connection." Not a webhook (webhook
  registration still requires separate explicit approval — see below).
  - Customers: matched via `external_square_customer_id` → email → phone
    → create new, per the customer-matching rules in `docs/DATABASE.md`.
  - Payments/refunds: written via the service-role client, since those
    tables have no authenticated-user insert policy by design (only ever
    written by a trusted server-side process — the sync action itself is
    what gates who may trigger a run, via `settings:edit`).
  - Bookings: requires the Square Appointments API. If the connected
    Square account doesn't have it enabled, this is reported honestly
    (`notAuthorized: true`) rather than failing the whole sync — customer/
    payment/refund sync still completes independently.
  - **Fully live-verified against the real production Square account**
    (2026-09-25, D-027, after the `SQUARE_LOCATION_ID` fix): 1,426
    customers matched / 20 updated / 1 created, **158 payments synced**
    ($18,105.27 in real completed revenue), 1 refund correctly skipped
    (payment outside this batch), 10 bookings found and correctly skipped
    (9 for no matching service catalog entry — catalog sync isn't built
    yet, not a bug; 1 for no customer). Zero failures across every phase.
    Also handled a genuine data-quality issue found in Square itself
    (multiple customer records sharing one email) without crashing or
    corrupting data.
- Mechanism for **webhooks** (not yet registered): Square webhooks,
  signature verified with `SQUARE_WEBHOOK_SIGNATURE_KEY`, `webhook_events`
  row keyed on Square's event id, idempotent processing, retry/error
  logging. The route can be written and unit-tested without being
  registered with the live Square account — that registration is a
  write/config action requiring explicit approval first, same posture as
  Shopify webhooks below.

## Base44

- Currently owns referral + rewards + application functionality.
- Phase 8 approach: inspect Base44's data model and API/export options once
  credentials are available, document mapping into `referrals` /
  `reward_transactions`, run the new system in parallel, verify, then retire
  Base44 functionality. Never delete Base44 data before verification (spec
  §26).

## n8n

- Phase 9: audit current workflows, keep only what's still needed, replace
  the rest with native automation (`automation_rules`, DB triggers, scheduled
  functions). Not rebuilt 1:1 by default (spec §27).

## Effsight → first-party galleries

- Not an API integration — Effsight is retired, not synced. Migration path is
  the testing checklist in spec §53: build the gallery system (Phase 4), prove
  it (test galleries, embed on Shopify, mobile/desktop, private galleries,
  uploads, updates, access security, performance, client experience), only
  then retire Effsight embeds from the live site.

## Integrations settings page (spec §34)

Settings → Integrations shows, per provider: connection status
(Connected/Not connected/Error), last sync time, and — for OAuth-style
providers — a connect/reconnect action. It reads from the `integrations`
table (`DATABASE.md`) for status/metadata only; it never renders a secret
value, consistent with `SECURITY.md`.
