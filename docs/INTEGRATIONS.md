# Integrations

Last updated: 2026-09-23

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

**Recommended integration approach** — a Shopify **Custom App**, not a
public OAuth app: this is a single-store internal integration (Disco
Sundays' own CRM talking to Disco Sundays' own store), so a Custom App
created directly in Shopify Admin → Settings → Apps and sales channels →
Develop apps issues an Admin API access token directly. No `API_KEY`/
`API_SECRET` OAuth pair is needed — that pattern is for public apps
distributed to other merchants, which this isn't. Use the **GraphQL Admin
API** (current, versioned quarterly) per the user's explicit instruction,
not the legacy REST Admin API.

**Environment variables needed** (names updated in both `.env.example`
files to match this recommendation):
- `SHOPIFY_STORE_DOMAIN` — the `*.myshopify.com` domain (not the storefront
  domain `discosundays.com` — GraphQL Admin API calls target the
  `.myshopify.com` hostname regardless of the storefront's custom domain).
- `SHOPIFY_ADMIN_ACCESS_TOKEN` — the Custom App's Admin API access token
  (starts `shpat_`), generated after the app is created and installed.
- `SHOPIFY_API_VERSION` — pin explicitly (e.g. `2025-01`); GraphQL Admin
  API versions roll quarterly and pinning avoids silent breakage.
- `SHOPIFY_WEBHOOK_SECRET` — only needed once webhook subscriptions are
  actually registered (a write/config action on the live store requiring
  explicit approval first, same posture as Square webhook registration).

**Minimum API scopes** (read-only — the CRM never writes back to Shopify,
per the source-of-truth rules above): `read_customers`, `read_orders`,
`read_products`. No `write_*` scopes needed for the sync described here.

**Does the user need to create/install anything?** Yes — a Custom App
must be created and installed in the Shopify Admin before any credential
exists to configure. This is the one manual step; everything after it
(adapter code, webhook route, sync logic) is build work Claude Code can do
without further owner involvement.

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
- Mechanism: Square webhooks, signature verified with
  `SQUARE_WEBHOOK_SIGNATURE_KEY`, `webhook_events` row keyed on Square's
  event id, idempotent processing, retry/error logging.
- Blocked on credentials — see `.env.example`. Architecture (adapter module,
  webhook route, DB tables) is built in Phase 3 regardless of whether
  credentials exist yet, per RULE 2 — only the actual API calls are inert
  until configured, and the Integrations settings page shows Square as
  "Not connected" honestly rather than faking a synced state.

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
