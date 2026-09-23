# Changelog

All notable changes to the Disco Sundays CRM project are recorded here,
newest first.

## Phase 1 — Foundation — 2026-09-23

- Scaffolded the Next.js 15 (App Router) + TypeScript + Tailwind app at
  `apps/web`, wired to the live Supabase project via `@supabase/ssr`
  (server client, browser client, middleware session refresh).
- Auth: email/password sign-in (server action), sign-out, middleware that
  redirects unauthenticated requests to `/login` for every route except the
  public surfaces (`/join`, `/gallery`, `/embed`, `/r/`).
- RBAC: `lib/auth/permissions.ts` calls the database's own
  `has_permission()` function rather than reimplementing the permission
  matrix in the app, so the app can never drift out of sync with what RLS
  enforces.
- Authenticated shell: responsive nav (desktop sidebar, mobile drawer)
  filtered to each signed-in user's actual permitted resources; settings
  page showing the signed-in profile and, for `settings:edit` roles, a
  read-only view of the live `role_permissions` table; dashboard with real
  customer/lead counts and an explicit empty state (no placeholder
  numbers); loading and error states.
- `apps/web/.env.local` pre-filled with the real (safe-to-expose) Supabase
  URL and publishable key.
- **Not done in this pass, by design**: Customers/Leads list & detail UI
  (Phase 2 application layer — the database side of Phase 2 is done, see
  below), and Vercel deployment (no Vercel project connected yet).
- **Verification status**: this sandbox cannot reach `registry.npmjs.org`,
  so `npm install` / `npm run build` / `npm run typecheck` could not be run
  here. The code follows well-established, stable Next.js App Router +
  `@supabase/ssr` patterns, but is not yet build-verified — that happens on
  the first Vercel deploy or the first local `npm install && npm run build`
  once one of those is possible. Flagged explicitly rather than claimed as
  tested.

## Phase 2 (database) — CRM core — 2026-09-23

- Applied `supabase/migrations/0003_phase2_crm_core.sql`: `customers`,
  `leads` (+ `lead_statuses`), `tags`, `customer_tags`, `notes`; added the
  `activities.customer_id` foreign key deferred from Phase 0.
- Ran advisors, found two missing FK indexes and three RLS policies that
  overlapped with a `for all` policy on the same table/action (performance
  finding, not a security hole); applied `0004_phase2_hardening.sql` to fix
  both and re-ran advisors clean (aside from expected "unused index" notices
  on tables with no data yet).
- Documented the source-of-truth matrix the user confirmed for every data
  type (Shopify/Square/CRM) in `docs/DECISIONS.md` D-011 — this governs how
  every future sync (Phase 3 Square, Phase 5 Shopify) gets built.
- Environment finding: this sandbox cannot reach `registry.npmjs.org` or
  `pypi.org` (`x-deny-reason: host_not_allowed`), and Anthropic's internal
  npm mirror at `artifactory.infra.ant.dev` requires credentials this
  session doesn't have. `npm install` / `next build` cannot be run here —
  see the message accompanying this changelog entry for what that means for
  Phase 1.

## Phase 0 — Discovery & Architecture — 2026-09-23

- Inspected connected environment:
  - GitHub: token present, no repository configured/reachable.
  - Supabase: project `nrmdcwezgdeiwcebbdcj` ("My Project") found — active,
    healthy, empty (0 tables, 0 migrations).
  - Vercel: no teams or projects visible.
  - Shopify: live connection confirmed — store "Disco Sundays"
    (discosundays.com).
- Created project documentation: `PROJECT_SPEC.md`, `ARCHITECTURE.md`,
  `DATABASE.md`, `INTEGRATIONS.md`, `SECURITY.md`, `DEPLOYMENT.md`,
  `DECISIONS.md`, this file.
- Created `.env.example` covering all planned integrations.
- Applied `supabase/migrations/0001_foundation.sql`: `user_role` enum,
  `profiles`, `role_permissions` (seeded with default access matrix for all 8
  roles), `audit_logs`, `activities`, RLS policies, `handle_new_user` trigger,
  `has_permission()` helper function.
- Ran Supabase security/performance advisors against `0001_foundation.sql`
  and applied `supabase/migrations/0002_harden_foundation.sql` to fix every
  finding (mutable function search_path, unintended RPC exposure of internal
  helper functions, per-row re-evaluation of `auth.*()` in RLS policies,
  unindexed foreign key). Re-ran advisors to confirm clean.
- Initialized local git repository (no GitHub remote configured yet).
