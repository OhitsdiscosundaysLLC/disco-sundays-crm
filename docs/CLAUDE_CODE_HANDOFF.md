# Claude Code Handoff — Disco Sundays CRM / Business Operating System

Last updated: 2026-09-23
Prepared by: a Cowork session (not Claude Code) that did not have local npm
registry access — see section AE.

This document exists so Claude Code can pick this project up without the
person re-explaining it. **`/docs/PROJECT_SPEC.md` remains the primary
product specification.** This file is a status report and orientation
layer on top of it — where the two ever seem to disagree, `PROJECT_SPEC.md`
plus the rest of `/docs` win, and the conflict should be raised to the user
rather than silently resolved either way (see section AG).

---

## A. Product purpose

Disco Sundays CRM is the operating system for Disco Sundays LLC, a creative
platform / media infrastructure business (studio services, artist
development, recording, mixing, photography, memberships, courses,
referrals, rewards). It is real production software, built in controlled
phases, not a demo. Full detail: `docs/PROJECT_SPEC.md`.

## B. Business context

Existing tools in production use, none of which this project replaces
without explicit approval: **Shopify** (storefront/ecommerce, permanent),
**Square** (bookings/payments/calendar, permanent), **Base44** (referrals/
rewards, migrated gradually), **n8n** (automation, reduced gradually),
**Effsight** (photo galleries, replaced only after the CRM's own gallery is
proven). See `docs/PROJECT_SPEC.md` §3 and `docs/INTEGRATIONS.md`.

## C. Current implementation status

**Updated 2026-09-23 by Claude Code**, after the section D-AH content below
was picked up. Original handoff status is preserved in git history; this
table reflects reality as of the Claude Code continuation.

| Phase | Status |
|---|---|
| 0 — Discovery & architecture | Done |
| 1 — Foundation (Next.js/auth/RBAC/layout) | Done, build-verified, live-verified with a real owner account |
| 2 — CRM | Done: database + Customers/Leads application UI. Live-verified end-to-end in a real browser (create/edit/tag/note/convert all confirmed against production Supabase, test data cleaned up after) |
| 3 — Services/Bookings/Payments | Schema + application UI done for Services (full CRUD) and Bookings (full CRUD, writes timeline activities). Payments is read-only by design (D-014) — no Square/Shopify credentials exist yet, so there's nothing to sync in; webhook handlers are the remaining work once credentials arrive |
| 4 — Projects + Galleries | Schema + full management UI done (create/publish/upload/cover/delete). Public `/gallery/[slug]` + `/embed/gallery/[id]` routes are built but need `SUPABASE_SERVICE_ROLE_KEY` (still not set anywhere — see below) to actually serve content — currently show an honest "not configured" message. Live-verified: customer/gallery/project creation, settings, publish/unpublish all confirmed against production Supabase. File upload and the public password gate itself weren't exercised (no file-picker in this sandbox's browser automation; service key not set) |
| 6 — Memberships | Done: schema + full CRUD UI (plans, memberships, live-computed usage from bookings). RLS verified via direct database simulation (see Phase 7 row — same method) |
| 7 — Referrals & Rewards | Done: schema + full UI (referral codes, qualification workflow, append-only reward ledger, idempotent "issue reward" action). RLS verified via direct database simulation — real bug found and fixed same-pass (reward-balance trigger function was directly RPC-callable, revoked). `SUPABASE_SERVICE_ROLE_KEY` configured and verified live via the public gallery routes (first real end-to-end proof they work) |
| Integrations status | Done: `integrations` table + Settings "Test connection"/"Sync now" UI (spec §34). **Square fully working, all 4 sub-syncs**: connectivity + customers (1,426 matched) + catalog (66 services) + payments (158 synced, $18,105.27) + bookings (9/9 created, catalog sync closed the gap that was skipping all of them) — after fixing `SQUARE_LOCATION_ID` and adding catalog sync (D-020, D-023, D-027, D-029). **Shopify blocked on a real, diagnosed cause**: `app_not_installed` — the Dev Dashboard app was never installed on the store. All 4 env vars confirmed correctly configured; this is not a credential problem (D-028) |
| Vercel deploy | Done: production live at `https://disco-sundays-crm.vercel.app` (D-022). Two real bugs found and fixed: Root Directory wasn't set (every request 404'd), and the public Supabase env vars were present but middleware crashed on them |
| Tasks | Done: schema + full CRUD UI, RLS-verified (D-024) |
| Reports | Done: `/reports`, real live queries only, no fabricated stats (D-025) |
| Global Search | Done: `/search` + header search box, covers customers/leads/projects/galleries/referrals (D-025) |
| Automation | Done: minimal engine (D-026) — `automation_rules` + a trigger on `activities` inserts, one action type (`create_task`). RLS-verified end to end (rule fires, task created with correct fields) |
| 5 (Shopify sync), 8 | Shopify connectivity check only, full sync not started (needs credentials — see below). 8 = Base44 — not started, no credentials |

**Credential incidents (2026-09-24, twice)**: the user pasted real
production Supabase, Square, and (separately, later) Shopify credentials
directly into chat, three times total across the session. None were ever
used, stored, or written anywhere — see `docs/CHANGELOG.md`'s Phase 6/7
and "Integrations status" entries, and `docs/DECISIONS.md` D-019/D-021.
Supabase + Square were **resolved properly** the same day: the user added
them to `apps/web/.env.local` directly (never through chat), verified
present by name only, and Square connectivity was proven live (found a
real, non-secret `SQUARE_LOCATION_ID` typo along the way, since fixed and
verified — see D-020, D-027). Shopify credentials were also entered
properly (fresh values, not the ones pasted into chat) as of 2026-09-25
— configured correctly in both `apps/web/.env.local` and Vercel, but
authentication still fails for an unrelated reason (the app isn't
installed on the store — see D-028). Base44 credentials still remain
outstanding.

**Vercel (resolved 2026-09-25)**: the user created the project and
connected the GitHub repo; Claude Code found and fixed two real
deployment bugs (Root Directory unset; two `NEXT_PUBLIC_*` env vars
present but crashing middleware) and confirmed production live at
`https://disco-sundays-crm.vercel.app` — see D-022. The Shopify Dev
Dashboard app's App URL still needs updating from its `https://example.com`
placeholder to this real URL, and per the user's explicit instruction that
change (and any new app version release) still needs their approval
before Claude Code touches it.

Resolved: repo is pushed to GitHub (`disco-sundays-crm`, verified via
`git fetch`) and an owner account exists and was verified working live
(sign-in, dashboard, RLS/RBAC all confirmed for the `owner` role).

**One real credential now needed**: `SUPABASE_SERVICE_ROLE_KEY`, to make
the public gallery routes actually serve galleries. Get it from Supabase
Dashboard → Project Settings → API → `service_role` key; put it in
Vercel's server-side env vars and `apps/web/.env.local` (never in chat).
See D-015.

## D. Exact completed work

- **Docs** (`/docs`): `PROJECT_SPEC.md`, `ARCHITECTURE.md`, `DATABASE.md`,
  `INTEGRATIONS.md`, `SECURITY.md`, `DEPLOYMENT.md`, `DECISIONS.md`,
  `CHANGELOG.md` — all current as of this handoff.
- **Supabase** (project `nrmdcwezgdeiwcebbdcj`, region us-west-2, Postgres
  17): four migrations applied and advisor-clean —
  `0001_foundation.sql`, `0002_harden_foundation.sql`,
  `0003_phase2_crm_core.sql`, `0004_phase2_hardening.sql`. Live tables:
  `profiles`, `role_permissions` (seeded, 112 rows), `audit_logs`,
  `activities`, `customers`, `leads`, `lead_statuses` (seeded), `tags`,
  `customer_tags`, `notes`. All have RLS enabled; see section K.
- **`apps/web`**: Next.js 15 (App Router) + TypeScript + Tailwind, wired to
  the live Supabase project via `@supabase/ssr`. Email/password auth,
  middleware-enforced route protection, RBAC-filtered navigation, dashboard
  (real counts, no placeholder numbers), settings page (own profile +
  read-only role_permissions table for permitted roles), loading/error
  states, responsive nav (desktop sidebar / mobile drawer). File-by-file
  detail is in the code itself and in `docs/CHANGELOG.md`'s Phase 1 entry.
- **Git**: local repository, 5 commits on `main`
  (`6bbf9f0` Phase 0 → `5582a6b` current), clean working tree, no secrets
  committed. **Not yet pushed to GitHub** — no repository was reachable
  from the environment that did this work (section AE explains why, in
  case the same constraint applies to Claude Code's environment too — it
  may well not).

## E. Exact incomplete work

Customers/Leads, Services/Bookings/Payments, Projects/Galleries,
Memberships, and Referrals/Rewards application UI are now done (see
section C). Remaining, in spec order: Square integration (credentials now
configured, read-only verification + adapter code is the next concrete
step), Shopify integration (inspected, not built — needs a Custom App
token), Base44 migration, Automation engine, Reporting, Global Search,
Tasks, Production hardening. None of these have any code written yet
except where noted.

## F. Architecture

Next.js (App Router) + TypeScript + Tailwind → Supabase (Postgres 17 +
Auth + Storage) → Shopify + Square (permanent, integrated not replaced).
GitHub for source control, Vercel for hosting. Full detail, including
repo layout, application layers, gallery/embed design, and automation
engine design: `docs/ARCHITECTURE.md`. Do not change this architecture
without a documented technical reason recorded in `docs/DECISIONS.md`.

## G. Database architecture

Full schema (built + planned, phase by phase) is `docs/DATABASE.md`. Do
not recreate a table that already exists there — check `mcp__Supabase__list_tables`
or the migrations directory before adding anything. Conventions used
throughout (soft delete via `deleted_at`, `numeric(12,2)` for money,
`citext` for case-insensitive matching, partial unique indexes so a
soft-deleted row doesn't block reuse of its email/external ID) are
documented in `docs/DATABASE.md` and `docs/DECISIONS.md` D-007/D-010 — keep
following them for new tables rather than introducing a second convention.

## H. Supabase configuration

- Project ref: `nrmdcwezgdeiwcebbdcj` · URL: `https://nrmdcwezgdeiwcebbdcj.supabase.co`
- Org: "Disco Sundays CRM" (`vovhwpqmjlaknltzswol`)
- The anon/publishable key is **not secret** and is already in
  `apps/web/.env.local` (gitignored) and `apps/web/.env.example`
  (committed, deliberately, since this key is safe to expose — see
  `docs/SECURITY.md`).
- The **service-role key has never been fetched or stored anywhere in this
  project** — not in a file, not in chat, not in this document. It isn't
  needed yet (no server-side privileged operation has been built). When one
  is (e.g. the `/join` public-registration server action, or a webhook
  handler), get it from the Supabase dashboard → Project Settings → API,
  and put it only in Vercel's server-side environment variables.

## I. Authentication

Supabase Auth, email/password. `apps/web/lib/supabase/{server,client}.ts`
are the two client factories; `apps/web/middleware.ts` +
`lib/supabase/middleware.ts` refresh the session and gate every route
except `/login` and the public surfaces (`/join`, `/gallery`, `/embed`,
`/r/`). A `profiles` row is auto-created (role `staff`, status `invited`)
on signup by a database trigger — there is no self-service path to `owner`
(see `docs/DECISIONS.md` D-003). **No owner account exists yet** — the
first one must be created via Supabase Auth (invite or sign-up) and then
promoted with a manual SQL update, by a human, since the system
deliberately has no automated path to grant `owner`.

## J. Roles and permissions

Eight roles (`owner`, `admin`, `manager`, `staff`, `photographer`,
`engineer`, `finance`, `marketing`) as a Postgres enum. Authorization is
data-driven via `role_permissions` (role × resource →
view/create/edit/delete), read through `public.has_permission()` — both
by RLS policies and by `apps/web/lib/auth/permissions.ts`, so the app and
the database can never drift apart on what a role can do. Adding a
permission is a data change (`update role_permissions ...` or, later, a
Settings UI), not a code change. Full detail: `docs/DATABASE.md`,
`docs/SECURITY.md`.

## K. Security / RLS

Every table with business data has RLS enabled from the migration that
creates it. Two internal SECURITY DEFINER helper functions
(`auth_role()`, `has_permission()`) back every policy; both were hardened
against unintended public RPC exposure in `0002_harden_foundation.sql`
(revoked from `anon`, restricted to `authenticated`). Full write-up,
including the credential-intake protocol and the production-safety default
("read first, modify later"): `docs/SECURITY.md`. A pre-existing
`public.rls_auto_enable()` function was found on the Supabase project
before any of this work started — it was not created by this project and
was deliberately left untouched (noted in `docs/SECURITY.md` §8).

## L. Shopify integration

**Not yet built.** Shopify is confirmed live-connected to the Cowork
session that did this work (store "Disco Sundays", domain
`discosundays.com`, plan Basic, currency USD) — but that connection is a
Cowork MCP connector, not credentials available to the deployed app. The
Next.js app has zero Shopify code yet. When built (Phase 5): webhook-first,
signature-verified, idempotent on `(provider, provider_event_id)`, external
IDs stored on `customers`/`payments`, Shopify remains source of truth for
its own data (section Q). See `docs/INTEGRATIONS.md`.

## M. Square integration

**Not yet built, and no Square credentials or connection exist anywhere in
this environment.** Architecture is documented (`docs/INTEGRATIONS.md`,
`docs/ARCHITECTURE.md` §7) so Phase 3 can implement it once credentials are
available — do not build it against guessed/placeholder credentials. If
credentials are needed, follow the credential-intake protocol in
`docs/SECURITY.md` §9: tell the user exactly what to get and from where;
never ask them to paste it into chat.

## N. Base44 status

Not inspected — no Base44 connector or credentials are available in this
environment. Phase 8 (migration) cannot start until access exists. Do not
delete or disable anything Base44-related; none of it has been touched.

## O. n8n status

Not inspected — no n8n connector or credentials are available. Phase 9
cannot start until access exists. Nothing n8n-related has been touched.

## P. Effsight status

Not touched, not inspected (it's not an API integration target — see
`docs/PROJECT_SPEC.md` §3). It stays live on the website until the CRM's
own gallery (not yet built) is fully tested per `docs/PROJECT_SPEC.md`
§53, and only then retired with the user's explicit approval.

## Q. Source-of-truth rules

Confirmed by the user, not inferred — this governs every future sync:

| Data | Source of truth |
|---|---|
| Shopify products, orders, ecommerce activity | Shopify |
| Square bookings, payment transactions, services (where Square-managed) | Square |
| CRM profile data, projects, tasks, galleries, referrals, reward ledger, activities, internal reporting | CRM/Supabase |

No blind two-way sync. Before building any sync, its own migration/PR must
document: source of truth, sync direction, which fields sync, conflict
behavior, duplicate handling, and retry/failure behavior. Full text:
`docs/DECISIONS.md` D-011.

## R. Synchronization rules

Webhook-first (not polling) wherever the provider offers webhooks.
Signature verification before touching any payload. A shared
`webhook_events` table (provider + provider_event_id unique) is the
idempotency mechanism — planned for Phase 3, not yet created. External IDs
(`external_square_customer_id`, `shopify_customer_id`, `base44_id`) are
already columns on `customers` (Phase 2 migration), ready for Phase 3/5/8
to populate.

## S. Customer deduplication rules

Ordered match: external provider ID → normalized email (case-insensitive,
via `citext`) → normalized phone → create new. Never auto-merge on a
low-confidence/fuzzy match — that goes to an admin merge workflow instead
(not yet built). Enforced today via partial unique indexes on `customers`
(`email`, `external_square_customer_id`, `shopify_customer_id`, `base44_id`,
each `where deleted_at is null`). See `docs/DATABASE.md` and
`docs/DECISIONS.md` D-009/D-010.

## T. Automation requirements

Minimal in v1 by design (spec §63 — do not overengineer). `activities` is
the append-only event log everything will hook into. An `automation_rules`
table (trigger → condition → action) is planned for Phase 9, not yet
created. Do not build a visual workflow builder or a general automation
platform. See `docs/ARCHITECTURE.md` §6.

## U. CRM modules

Dashboard, Customers, Leads, Bookings, Services, Projects, Galleries,
Memberships, Referrals, Rewards, Payments, Tasks, Reports, Team, Settings —
per `docs/PROJECT_SPEC.md` §4. Nav is already built and permission-filtered
in `apps/web/components/nav.tsx`; most of the linked routes have no page
yet (404 via the custom `not-found.tsx`, which is honest, not a "coming
soon" stub — see section AG).

## V. Gallery requirements

High priority (Effsight replacement). Not yet built. Full requirements and
the planned architecture (Supabase Storage, public/private buckets, signed
URLs for private media, slug-based public route, iframe embed that reflects
live edits without touching Shopify) are in `docs/PROJECT_SPEC.md` §17–21
and `docs/ARCHITECTURE.md` §5. Testing checklist before Effsight retirement:
`docs/PROJECT_SPEC.md` §53.

## W. Referral/reward requirements

Not yet built. Reward system must be an append-only ledger
(`reward_transactions`), never a mutable balance column — this is decided,
not optional (`docs/DECISIONS.md` D-008). Reward amounts/qualification
rules are not defined by the business yet — make them configurable, do not
invent permanent values (`docs/PROJECT_SPEC.md` §60).

## X. Membership requirements

Not yet built. Plans and rules must be configurable
(`membership_plans`), not hardcoded. Usage is computed from real
bookings/activity, never hand-entered. `docs/DATABASE.md` Phase 6 section.

## Y. Task management

Not yet built. Straightforward CRUD table (`docs/DATABASE.md`
"Cross-cutting" section) — no special design decisions pending.

## Z. Reporting

Not yet built. Must be computed from real underlying records — no
hardcoded/fake statistics, ever (spec RULE 2).

## AA. Testing requirements

No automated tests exist yet — none were written for `apps/web` because
the code has never been build-verified (section AE), and writing tests for
unverified code isn't meaningful. Before or alongside the first real
feature work, Claude Code should: run `npm install && npm run build` in
`apps/web` to get a real baseline, fix whatever that surfaces, then start
adding tests per `docs/PROJECT_SPEC.md` §57 (auth, authorization, CRUD,
duplicate prevention, webhook idempotency, gallery access, etc. as each
area is built).

## AB. Deployment requirements

No Vercel project or GitHub repository is connected yet. See
`docs/DEPLOYMENT.md` for the target setup once both exist. This is the
first thing to resolve — see section AE and `docs/CLAUDE_CODE_START.md`.

## AC. Environment variables required

Root `.env.example` lists everything across every planned integration,
each marked server-only vs. public and annotated with which phase needs
it. `apps/web/.env.example` lists only what the app currently reads
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — both already
filled with real, safe-to-expose values). Nothing else is needed until
Phase 3 (Square) or Phase 5 (Shopify) adds real integration code — don't
add env vars speculatively.

## AD. Known issues

- Resolved by the Claude Code continuation: the build-verification gap
  (section AE) is closed — `npm run build`/`typecheck`/`lint` all pass. Two
  real issues it found are fixed: implicit-`any` cookie callback params
  under `strict` mode, and `@supabase/ssr` was pinned to a version
  (`^0.5.2`) incompatible with the `@supabase/supabase-js` it resolved
  against (see D-013).
- No owner-role account exists in `profiles` yet — sign-in has nothing to
  authenticate against until one staff account is created and promoted
  (section I). This is the one remaining manual step besides the GitHub
  push.
- Root `apps/web/package.json` briefly existed as a stray `npm init -y`
  scaffold from a blocked install attempt; it was overwritten with the
  real one before committing. Nothing to clean up, noted here only so a
  `git log -p` of that commit doesn't look suspicious.

## AE. Known limitations (of the environment that did this work, not necessarily of Claude Code's)

The Cowork sandbox that built Phases 0–2 could not reach
`registry.npmjs.org` or `pypi.org` (`403`, `x-deny-reason: host_not_allowed`
— a network policy block, confirmed via the environment's own proxy
diagnostics, not a transient error) and had no working credentials for
Anthropic's internal npm mirror. **This meant `npm install` / `next build`
/ any test run were never possible there.** If Claude Code's environment
has normal npm registry access (likely, since Claude Code typically runs
in a full dev environment), this limitation simply doesn't apply — the
very first thing to do is confirm that by running the install/build and
fixing whatever it finds. This is not a design constraint on the product;
it's a fact about one environment's network policy.

Separately: that same session's GitHub token was repository-bound with no
repository configured, and could not create or discover a repository via
the API (confirmed by a direct `POST /user/repos` attempt, which was
rejected the same way as browsing). That's why this work is not yet
pushed anywhere. See `docs/CLAUDE_CODE_START.md` for what to do about it.

## AF. Important decisions

Full log with rationale: `docs/DECISIONS.md` (D-001 through D-011).
Headlines: adopt the existing empty Supabase project as-is (D-002);
enum + data-driven `role_permissions` for RBAC, no self-service owner
role (D-003); `activities` created before `customers` existed, FK added
later (D-004); money as `numeric(12,2)` + explicit currency, soft delete
via `deleted_at` (D-007); rewards as an append-only ledger, never a mutable
counter (D-008); strict ordered customer matching, no fuzzy auto-merge
(D-009); `citext` + partial unique indexes for Phase 2 dedup, lead statuses
as a data table not an enum (D-010); confirmed source-of-truth matrix
(D-011, section Q above).

## AG. Forbidden / destructive actions

Do not, without the user's explicit approval in that exact conversation:
delete or reset any production data; drop or destructively alter an
existing table; delete, disable, or modify Base44, n8n workflows, or
Effsight; disconnect or reconfigure production Shopify or Square; force-push
or rewrite git history; commit a real secret (service-role key, Square
token, Shopify secret, Base44 key) anywhere, ever; replace this
architecture (Next.js/Supabase/Shopify+Square) without recording a reasoned
alternative in `docs/DECISIONS.md` first; build a fake/stub version of
requested functionality instead of the real thing or an honestly-labeled
"not built yet." Read-first-modify-later is the default posture for every
connected system (`docs/SECURITY.md` §10).

## AH. Exact next implementation phase

Phases 0–4, 6, 7, Integrations status, Vercel deploy, Square sync, Tasks,
Reports, Global Search, and Automation are all done (section C, D-020
through D-026). Production is live at
`https://disco-sundays-crm.vercel.app`. Every item in the user's stated
priority order (Square → Tasks/Reports/Search/Automation) is complete.

**Square is fully resolved** (D-027) — `SQUARE_LOCATION_ID` fixed,
verified live, full sync re-run: 158 payments/$18,105.27 synced, zero
failures. No further Square action needed until webhook registration is
approved.

Genuinely blocked on the user: **Shopify app installation** — not a
credential problem. All 4 env vars are correctly configured; Shopify's
own API returns `app_not_installed` (D-028). Fix: Dev Dashboard →
"Disco Sundays CRM" → Home → scroll down → **Install app** → select
`disco-sundays.myshopify.com` → **Install**. Nothing else blocks
progress.

Next, in order —
1. Once the Shopify app is installed on the store: re-run "Test
   connection" to verify auth/shop/customers/orders/products live, then
   build the Shopify sync adapter (customers/orders — see
   `docs/INTEGRATIONS.md`). Update the Shopify Dev Dashboard app's App
   URL from its `example.com` placeholder to the real production URL —
   **only with the user's explicit approval**, and only that field, not
   a new app version otherwise.
2. Base44 migration, n8n workflow audit — once credentials/access exist
   for those.
3. Square webhook registration — architecture (`webhook_events`,
   signature verification) can be written and unit-tested now, but not
   registered with the live Square account without explicit approval.
4. Security hardening pass + end-to-end workflow test per the "Final
   Definition of Done" criteria, once the above are in.

Continue phase by phase per RULE 7, testing at each boundary. Live browser
verification requires a signed-in session — it's been intermittently
available across this project (sometimes still valid, sometimes not);
when unavailable, fall back to the direct-RLS-simulation method used for
Phases 6, 7, and Tasks (documented in their CHANGELOG entries), or — for
integration code that needs to call a real external API — a one-off
script run via `node --env-file=.env.local`/`npx tsx` against the actual
function (see D-023), deleted after use, never committed.
