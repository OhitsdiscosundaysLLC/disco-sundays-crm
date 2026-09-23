# Architecture

Last updated: 2026-09-23

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | Server components by default; client components only where needed (uploaders, galleries, interactive tables). |
| UI | Tailwind CSS + a small internal component library | No heavy component framework. Premium, restrained, table/form-first design per spec §43. |
| Backend/data | Supabase (Postgres 17, Auth, Storage) | System of record. Project `nrmdcwezgdeiwcebbdcj` ("My Project"), region us-west-2 — see `DECISIONS.md` D-002 for the rename/adoption decision. |
| Hosting | Vercel | Not yet connected to this workspace (0 teams/projects found in discovery). Connected in Phase 1. |
| Source control | GitHub | Not yet connected to this session (see `DECISIONS.md` D-001). Working locally until resolved. |

## 2. Repository layout

```
/docs                      project memory (this folder)
/supabase/migrations       versioned SQL migrations (source of truth for schema)
/apps/web                  Next.js application (created in Phase 1)
  /app                     App Router routes
    /(public)/join         public registration
    /(public)/gallery/[slug]      client-facing gallery
    /(public)/embed/gallery/[id]  embeddable gallery (iframe target)
    /(public)/r/[code]      referral link redirect
    /(app)/...             authenticated CRM (dashboard, customers, ...)
    /api/...               server route handlers (webhooks, integration callbacks)
  /lib
    /supabase              server + browser Supabase clients
    /auth                  session + permission helpers
    /integrations          square/, shopify/, base44/ adapters
    /automation            trigger/action engine
  /components
.env.example
```

Next.js app is not built yet (Phase 1). This layout is the agreed target so
Phase 1 starts from a decision, not a blank page.

## 3. Application layers

1. **UI (Server/Client Components)** — never talks to Postgres directly for
   privileged data; always goes through the API layer or Supabase client with
   RLS enforcing what the signed-in user may see.
2. **API layer (`/app/api/*` route handlers + server actions)** — business-level
   operations ("createBooking", "publishGallery"), not raw SQL passthrough.
   This is where the Supabase **service role** key is used, server-side only.
3. **Data layer (Postgres + RLS)** — the last line of defense. Every table with
   business data has RLS enabled; policies are role-driven (see `SECURITY.md`).
4. **Integration adapters** — one module per external system (Square, Shopify,
   Base44), each exposing a narrow interface (`syncCustomer`, `syncBooking`,
   `verifyWebhook`, `handleEvent`) so the rest of the app never imports a
   provider SDK directly.
5. **Automation engine** — internal trigger → action system (see §6).

## 4. Public surfaces

| Route | Purpose | Auth |
|---|---|---|
| `/join` | Public customer registration (spec §8) | none (rate-limited, validated server-side) |
| `/gallery/[slug]` | Client-facing gallery viewer (spec §20) | slug + optional password/expiry, no login required |
| `/embed/gallery/[id]` | Iframe-embeddable gallery (spec §19) | same access rules as above, stripped chrome, `X-Frame-Options` deliberately permissive for this route only |
| `/r/[code]` | Referral link redirect → `/join?ref=code` | none |

Everything else lives under an authenticated app shell.

## 5. Gallery + embed architecture (spec §17–21, high priority)

- Media lives in **Supabase Storage**, never in Postgres. Bucket layout:
  `galleries/{gallery_id}/{asset_id}.{ext}`, `projects/{project_id}/...`,
  `customers/{customer_id}/...`.
- Two buckets: `gallery-public` (public galleries, cover images) and
  `gallery-private` (password/expiring/private galleries) — private bucket
  serves only **signed URLs** with short TTLs, generated server-side.
- A gallery has a stable `id` and a public `slug`. The embed route renders the
  *current* published state on every load (server component, no caching layer
  that would go stale) — editing a gallery in the CRM is reflected on the
  embedded page without touching Shopify, satisfying spec §19's core
  requirement.
- Thumbnails are generated server-side on upload (Phase 4) so the client
  viewer never loads full-resolution originals for the grid.
- `gallery_access` table controls: public/private, password hash, expiry,
  download permission — checked on every request to `/gallery/[slug]` and
  `/embed/gallery/[id]`, not just at link-generation time.

## 6. Automation engine (spec §28)

Minimal in Phase 1–8, extensible by design:

- `activities` table is an append-only event log. Every meaningful state
  change (`booking.created`, `payment.received`, `gallery.published`, ...)
  writes one row.
- A single `automation_rules` table (trigger event, condition JSON, action
  type, action config) is evaluated by a server-side function invoked after
  the event is written (Postgres trigger → `pg_notify`/function call, or a
  server action calling it directly — decided in Phase 9 once real triggers
  exist to design against).
- Initial actions supported: create activity (automatic), create task, update
  customer field, issue reward, send notification. No visual workflow builder
  in v1 (spec §63 — do not overengineer).

## 7. Integration architecture (summary — full detail in `INTEGRATIONS.md`)

- Square and Shopify are both **webhook-first**: signature verification →
  `webhook_events` row (idempotency key = provider event id) → process → mark
  processed. No polling where a webhook exists.
- All external IDs are stored alongside our own primary keys
  (`external_square_customer_id`, `shopify_customer_id`, etc.) — never used as
  our primary key, so we're never hostage to a provider's ID scheme.
- Customer matching order: external ID → email → phone → manual merge. Never
  auto-merge on a low-confidence match (spec §33).

## 8. Environments

- **Local/dev**: Supabase local stack or a dev branch of the connected
  project once branching is set up; demo data allowed, clearly separated.
- **Production**: the connected Supabase project, Vercel production
  deployment. No demo/fake data ever mixed into production tables.

## 9. Why not [alternative]

- **No ORM chosen yet** — Supabase's generated types + typed query builder is
  sufficient for v1; an ORM (Drizzle/Prisma) can be introduced later without a
  schema change if query complexity grows. Documented so it isn't re-litigated
  every phase.
- **No microservices** — single Next.js app + Supabase. Spec §63 explicitly
  rules this out for v1.
