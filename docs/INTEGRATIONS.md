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
