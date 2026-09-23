# Changelog

All notable changes to the Disco Sundays CRM project are recorded here,
newest first.

## Claude Code handoff continuation — Phase 2 application layer — 2026-09-23

Picked up the Cowork handoff (see `docs/CLAUDE_CODE_HANDOFF.md`). Verified
the handoff docs against reality first (Supabase schema matched exactly;
the claimed local git history did not exist on disk).

- **Git**: no `.git` directory was actually present despite the handoff
  claiming 5 local commits. Initialized fresh and committed the received
  state honestly as one commit rather than fabricating history. Still not
  pushed to GitHub — no `gh` CLI or token available in this environment
  either; exact manual step given to the user.
- **First real build** (`npm install && npm run build && npm run
  typecheck`, run for the first time — see handoff section AE): fixed two
  real issues it surfaced — implicit-`any` cookie callback params in
  `lib/supabase/{server,middleware}.ts` under `strict` mode, and no ESLint
  config (`next lint`'s setup wizard can't run non-interactively; added the
  standard flat config it would have generated). Added a generated
  `database.types.ts` (via Supabase's typegen) and wired both Supabase
  client factories to it, so every table query is now type-checked instead
  of `any`. Corrected `@supabase/ssr` to `^0.12.7` — see D-013.
- **Database fix**: `activities` was missing its insert policy (Phase 2 gap
  in the handoff's own migrations) — added
  `0005_phase2_activities_write.sql`. See D-012.
- **Customers**: list (search across name/email/phone/company/artist name,
  permission-gated create button), create, edit, profile page (contact
  info, external-sync badges for Square/Shopify/Base44, tag add/remove,
  notes add/delete with author-or-delete-permission gating, append-only
  timeline fed by every mutating action), soft-delete (archive).
- **Leads**: list (status-filter chips backed by the live `lead_statuses`
  table, search), create, edit, detail page, soft-delete, "Convert to
  customer" — ordered dedup match (email → phone → create new) per D-009,
  writes a `lead.converted` timeline activity on the resulting customer,
  never silently double-creates a customer for an already-converted lead.
- Every server action re-checks the caller's permission server-side via
  `has_permission()` before writing (SECURITY.md's two-layer requirement);
  RLS is the backstop either way.
- **Verification**: `npm run build`, `typecheck`, and `lint` all pass clean.
  Confirmed in a real browser that unauthenticated requests to the new
  `/customers` and `/leads` routes correctly redirect to `/login` (no
  console/server errors). Full authenticated CRUD click-through is still
  pending the first owner account (no self-service path to `owner` by
  design — D-003 — the human step is documented in
  `docs/CLAUDE_CODE_HANDOFF.md`).
- **Not done in this pass**: Vercel deployment (no project connected yet).

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
