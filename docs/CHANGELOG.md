# Changelog

All notable changes to the Disco Sundays CRM project are recorded here,
newest first.

## Claude Code handoff continuation — Vercel live, Square sync, Tasks, Reports, Search — 2026-09-25

- **Vercel production deploy fixed and verified live** (D-022). The user
  connected the project and asked for it to be verified; found and fixed
  two real bugs blocking it:
  1. Root Directory wasn't set to `apps/web` — every request returned a
     platform-level `404 NOT_FOUND`. Fixed via `update_project`
     (rootDirectory + framework), then redeployed.
  2. `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` were present
     in Vercel's env vars but middleware crashed with
     `MIDDLEWARE_INVOCATION_FAILED` on every request. Fixed by setting both
     explicitly (these two are meant to be public — already shipped in the
     site's own JS bundle — unlike the service role key or Square/Shopify
     secrets, which were left untouched) and triggering a fresh build
     (`NEXT_PUBLIC_*` is inlined at build time in Next.js).
  Production URL confirmed live: `https://disco-sundays-crm.vercel.app`
  — real login page renders, confirmed via a fresh browser tab and a
  direct network request. Also confirmed Vercel Authentication doesn't
  gate the production alias, only ephemeral per-deployment URLs (desired
  behavior, no change needed).
- **Square read-sync adapter built and verified against the real
  production Square account** (D-023): `lib/integrations/square/sync.ts`
  — customers, payments, refunds, and bookings (best-effort — gracefully
  reports "not authorized" if the account lacks the Appointments API
  rather than failing the whole run). Wired to a new "Sync now" button in
  Settings → Integrations next to Square's existing "Test connection."
  Found and fixed two real bugs during live verification: a race
  condition on repeated syncs (`23505` on `customers_square_id_key`) and a
  genuine data-quality issue in the real Square account (multiple customer
  records sharing one email, hitting `customers_email_key`) — both now
  handled by catching the unique-violation and re-matching instead of
  failing. Live-verified against production: **1,375 real Square
  customers matched/created correctly** with the fix in place. Payments/
  refunds/bookings sync did not complete this pass — Square rejected the
  request with `Not authorized to list payments for location_id:
  BRQ3J5MYKNYX`, confirming the `SQUARE_LOCATION_ID` typo flagged back in
  the Integrations status entry below is now a real functional blocker,
  not just cosmetic. Improved the sync's error messages to surface
  Square's `detail` field so this is immediately diagnosable from a log
  line. No code changes needed once the env var is corrected — see
  `docs/DECISIONS.md` open question 3.
  `supabase/migrations/0012_phase_square_sync_idempotency.sql` adds the
  missing unique index on `refunds.provider_refund_id`.
- **Tasks module built** (spec priority list, D-024):
  `supabase/migrations/0013_phase_tasks.sql` (`task_statuses` + `tasks`,
  RLS via the existing `tasks` resource permissions already seeded since
  Phase 0) plus full CRUD UI (`/tasks`, `/tasks/new`, `/tasks/[id]/edit`) —
  create, edit, mark done, delete, optional link to a customer. Verified
  via direct RLS simulation (insert/update/delete all succeed for the
  owner role under real policies, no active browser session this turn).
- **Reports module built** (D-025): `/reports` — revenue this month/year,
  active memberships + estimated MRR, referrals qualified/total, rewards
  issued/redeemed, bookings by status. Every number is a live query under
  the viewer's own RLS session, never the service role — a role without
  `payments:view` simply sees that section empty, same as the Payments
  page itself.
- **Global Search built** (D-025): `/search` plus a search box in the app
  header, covering customers/leads/projects/galleries/referrals — each
  section gated by that resource's own view permission before querying.
- **Automation engine built** (spec §63, D-026), the last item in the
  user's stated priority order: `supabase/migrations/0014_phase_automation.sql`
  adds `automation_rules` + a `SECURITY DEFINER` trigger
  (`run_automation_rules()`) on `activities` inserts — when a rule's
  `trigger_event` matches the new activity's `type`, it creates a follow-up
  task (the only action type in v1, per "don't overbuild"). RPC execute
  revoked from anon/authenticated, same hardening posture as
  `apply_reward_transaction()`. Settings → Automation gained a rules
  list (pause/activate/delete) + create form. Verified live via direct
  RLS simulation: created a rule, inserted a matching activity, confirmed
  the task was auto-created with the right title/priority/due date, then
  confirmed the trigger function itself isn't directly RPC-callable by
  anon or authenticated.
- Two unindexed foreign keys the Supabase performance advisor flagged
  after this pass (`tasks.created_by`, `automation_rules.created_by`)
  fixed in `supabase/migrations/0015_phase_tasks_automation_fk_indexes.sql`.
  Security advisor re-run clean otherwise — the only findings are
  pre-existing ones already documented (D-002's `has_permission`/
  `auth_role` being intentionally public RPCs, and the leaked-password
  toggle).
- Regenerated `apps/web/lib/supabase/database.types.ts` after each schema
  change. `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean
  after every change in this pass.

## Claude Code handoff continuation — Integrations status + Shopify Dev Dashboard — 2026-09-24 (second pass)

- **Second credential-exposure incident**: the user pasted a Shopify
  Client ID and Client Secret directly into chat. Same response as the
  first incident (Phase 6/7's Supabase+Square paste): neither value was
  used, stored, echoed, or written anywhere. User told to treat the
  secret as exposed and regenerate it from the Dev Dashboard, then enter
  fresh values directly into `apps/web/.env.local` / Vercel — never
  through chat.
- **Vercel inspection — genuine blocker found**: the Vercel MCP connector
  reports zero teams and zero projects visible to this session,
  account-wide (not just for this repo); a direct lookup of a project
  named `disco-sundays-crm` 404s. Cannot create a Vercel project without a
  team ID to create it under, and none is available. Reported as
  ACTION REQUIRED — either authorize Vercel access for this session, or
  the user creates the project directly at vercel.com (Import Git
  Repository → `OhitsdiscosundaysLLC/disco-sundays-crm`, root `apps/web`).
  Production URL — and therefore the Shopify app's App URL — remains
  unresolved until this is done.
- **Square connectivity verified live with real production credentials**
  (first time, via the new Settings UI below): confirmed authentication
  works, found a real (non-secret) data bug — `SQUARE_LOCATION_ID` in
  `apps/web/.env.local` is `BRQ3J5MYKNYX`, missing the leading `L` from
  the actual location ID `LBRQ3J5MYKNYX` ("Hanover, MD") — flagged to the
  user for a one-character fix, not corrected automatically.
- **Built the `integrations` table + Settings status UI** (spec §34,
  previously undocumented as built): `provider`/`status`/
  `last_checked_at`/`metadata` (never secrets), seeded for square/shopify/
  base44. Settings page now shows real connection status per provider with
  a "Test connection" button (owner/admin only) that performs an actual
  read-only API call and writes the real result. See D-020.
- **`lib/integrations/square/client.ts`**: read-only `GET /v2/locations`
  connectivity check. Verified live in a real browser: clicked "Test
  connection," confirmed via direct database read that the row updated to
  `connected` with real location data (no secrets stored).
- **`lib/integrations/shopify/client.ts`**: built after correcting course
  on the auth model — the user's app lives in Shopify's newer Dev
  Dashboard, which uses a Client ID + Client Secret exchanged for a
  short-lived token via the OAuth client-credentials grant, not the
  static Admin API token originally assumed. Verified this against
  Shopify's current documentation before writing any code (not guessed).
  Read-only verification samples 3 each of customers/orders/products via
  GraphQL — exactly the requested scopes, nothing written to Shopify,
  nothing synced into the CRM yet. Verified live: the graceful
  "not configured" path correctly writes `status: 'error'` with a clear
  message when credentials are absent (real credentials not tested yet —
  none exist anywhere reachable by this project, per the incident above).
  See D-021.
- **Not done yet, deliberately**: actual customer/booking/payment/order
  sync adapters for either provider (connectivity proof only, per
  instruction, before building further); any webhook registration for
  either provider (explicit approval required first — D-014); the
  Shopify app's App URL still shows the `https://example.com` placeholder
  and was **not** touched, per the user's explicit instruction not to
  release another app version yet.
- Docs: CHANGELOG, DECISIONS (D-020, D-021), DATABASE, INTEGRATIONS
  (Shopify section corrected to the Dev Dashboard model), both
  `.env.example` files.

## Claude Code handoff continuation — Phase 7 (Referrals & Rewards) — 2026-09-24

- **Credentials configured**: the user added `SUPABASE_SERVICE_ROLE_KEY`
  and Square production credentials to `apps/web/.env.local` directly
  (never pasted into chat). Presence verified by variable name only. The
  Square variable names that arrived differ from this project's original
  `.env.example` templates (no `_PRODUCTION_` infix) — adopted as
  canonical rather than asking for a rename; both `.env.example` files
  updated to match. See D-019.
- **`SUPABASE_SERVICE_ROLE_KEY` verified working**: created a temporary
  public gallery and a temporary password-protected private gallery
  directly in the database, loaded both through the real `/gallery/[slug]`
  route against a local dev server. Public gallery rendered real content;
  private gallery correctly prompted for a password and correctly rejected
  an incorrect one. This is the first live proof the public gallery system
  (built in Phase 4, previously untestable without this key) actually
  works end to end. Test data deleted immediately after.
- **Database**: applied `0009_phase7_referrals_rewards.sql` — `referrals`,
  `reward_accounts`, `reward_transactions`, `customers.referral_code`. Found
  and fixed a real issue in the same pass this time (not a separate
  follow-up like prior phases): the advisor caught `apply_reward_transaction()`
  (the balance-maintaining trigger function) being directly callable via
  PostgREST RPC — fixed immediately with `0010_phase7_harden_reward_trigger.sql`,
  same pattern as `0002`'s original hardening of `set_updated_at()`/
  `handle_new_user()`.
- **Referrals**: create (referrer/referred/source/code), qualification
  status management (pending/qualified/rejected), customer timeline
  integration, admin list + detail views.
- **Rewards**: append-only ledger (never a mutable balance — D-008,
  reaffirmed). "Issue reward" action on a qualified referral, idempotent
  by database constraint (a referral can only be paid once). Reward
  amounts are entered per-issuance by staff, not a fabricated default — see
  D-018 for why. Ledger + balances view at `/rewards`. Customer profile
  page now shows referral code (with a "Generate" action), reward balance,
  and referrals made.
- **Known, deliberate gap**: the public `/r/[code]` referral-link redirect
  described in `docs/ARCHITECTURE.md` §4 was not built — `/join` (public
  registration) doesn't exist anywhere in this project yet, so a working
  `/r/[code]` would have nowhere real to send someone. Referral codes work
  for internal/manual tracking today; the public flow is real architecture
  waiting on a real destination, not a stub — see D-018.
- **Verified**: build/typecheck/lint all pass. RLS verified by simulating
  authenticated Postgres requests (same method introduced in Phase 6,
  necessary again since the browser session is still expired): referral
  creation, reward issuance, and the balance trigger all work correctly as
  the owner role; a duplicate `referral_reward` for the same referral is
  correctly rejected (idempotency); a self-referral is correctly rejected
  by the check constraint; `reward_accounts` correctly has no delete
  policy for authenticated users (confirmed by hitting exactly that
  restriction during test cleanup, which needed elevated privileges
  instead). No data left in production.
- **Shopify inspection performed** (read-only, no code changes) per the
  user's request: no Shopify integration exists anywhere in this project
  beyond placeholder ID columns (`customers.shopify_customer_id`,
  `services.shopify_product_id`, `payments.provider = 'shopify'`) and
  planned variable names in the root `.env.example`. No SDK/GraphQL client
  installed, no webhook route, no sync code, nothing configured in
  `apps/web/.env.local`. Recommended approach: a Shopify **Custom App**
  (single-store internal integration, not a public OAuth app) using the
  current GraphQL Admin API, scopes `read_customers`/`read_orders`/
  `read_products` only (read-only sync, per source-of-truth rules — the
  CRM never writes back to Shopify). Full findings in this entry's
  companion chat report; env var names updated in both `.env.example`
  files to reflect the recommended Custom App token approach
  (`SHOPIFY_ADMIN_ACCESS_TOKEN` rather than the OAuth `API_KEY`/
  `API_SECRET` pair, which isn't needed for a Custom App).
- Docs updated: CHANGELOG, DECISIONS (D-018, D-019), DATABASE, both
  `.env.example` files.

## Claude Code handoff continuation — Phase 6 (Memberships) — 2026-09-24

- **Credential handling incident**: the user pasted real production
  credentials directly into chat (Supabase `service_role` key, Square
  production Application ID/Access Token/Application Secret/Location ID).
  None were used, stored, written to any file, or echoed back — this
  project's standing rule is that credentials are never entered into any
  field by the assistant, even when explicitly handed over. The user was
  told to treat them as exposed (chat is not a secure channel) and advised
  to rotate both before relying on them, and given the exact secure
  entry point (Vercel env vars / local `.env.local`) for when they're ready
  to configure them properly. As of this entry, no production credentials
  exist anywhere in this project's reachable environment — confirmed by
  checking `apps/web/.env.local` directly (only the two public Supabase
  values are present).
- **Database**: applied `0008_phase6_memberships.sql` — `membership_plans`,
  `memberships`, `membership_usage`, plus a nullable `bookings.membership_id`
  so usage can be computed from real booking activity (D-017). Also fixed
  an `audit_logs` gap of the same shape as D-012: no insert policy existed
  for authenticated users, so sensitive-action logging (required by
  `docs/SECURITY.md` §5, including membership changes) had no real write
  path. Added one with actor-spoofing prevention — see D-016.
- **Membership plans**: full CRUD application UI.
- **Memberships**: full CRUD application UI — customer/plan assignment,
  status (active/paused/cancelled/expired), renewal date, billing metadata.
  Creation and status changes write a customer timeline activity. Usage is
  shown as a live computation over bookings attributed to the membership
  (via the new optional `membership_id` field added to the booking form),
  never a hand-entered number.
- **Verified**: build/typecheck/lint all pass. The browser session used for
  live UI testing in prior phases had expired (long-running session) and
  the assistant does not have and will not request the owner's password to
  re-authenticate — so this phase was verified differently: by simulating
  authenticated Postgres requests directly against the live database
  (`set local role authenticated` + `request.jwt.claims`), confirming (a)
  the owner role can create/read/delete membership plans and memberships
  exactly as the RLS policies intend, (b) an unrecognized identity is
  correctly denied, and (c) the new audit_logs anti-spoofing check
  correctly allows self-attributed entries and rejects forged ones. No
  data was left in production (test paths ran inside transactions that
  were not committed; production counts confirmed at zero afterward).
  Full click-through browser verification of this phase specifically is
  still outstanding — flagged honestly rather than claimed.
- Docs updated: CHANGELOG, DECISIONS (D-016, D-017), DATABASE, SECURITY.

## Claude Code handoff continuation — Phase 4 (Projects + Galleries) — 2026-09-23

- **Database**: applied `0007_phase4_projects_galleries.sql` —
  `project_statuses`/`projects`/`project_members` (brought forward from the
  "cross-cutting" section since galleries reference `project_id`);
  `galleries`/`gallery_assets`/`gallery_views`; `gallery-public`/
  `gallery-private` Storage buckets. Resolved the `gallery_access` design
  question DATABASE.md had left open — folded onto `galleries` directly
  rather than a separate table (D-015). Advisors re-ran clean.
- **Projects**: full CRUD application UI (list, create, edit, archive).
- **Galleries**: full management UI — create/edit settings (title,
  project, visibility, password, expiry, downloads), publish/unpublish,
  drag-free multi-file upload straight to Supabase Storage from the
  browser (client-side, authenticated, RLS-gated), cover selection, asset
  delete, public-link + iframe-embed snippet display.
- **Public gallery routes**: `/gallery/[slug]` and `/embed/gallery/[id]`
  built and wired up. Per D-015 these read through the Supabase **service
  role** (never anon-key RLS) so password verification can happen safely
  server-side and `password_hash` is never client-reachable. Password
  hashing uses `node:crypto` scrypt — no new dependency. A signed,
  httpOnly cookie (HMAC over `SUPABASE_SERVICE_ROLE_KEY`, 24h TTL) remembers
  a correct password entry so visitors aren't re-prompted on every page
  load.
- **First real use of `SUPABASE_SERVICE_ROLE_KEY`** in this project — not
  yet set anywhere, so the public routes currently show an honest "not
  configured yet" message instead of an error or fake content. Exact
  credential-intake step recorded in D-015 and `apps/web/.env.example`.
- **Verified live**: created a real customer, a password-protected private
  gallery, and a project against production Supabase using the owner
  account — creation, settings, and publish/unpublish all confirmed
  working, including the public route's graceful "not configured" fallback
  (proving it fails honestly, not silently, without the service key).
  Actual file upload and the password-entry gate on the public route
  itself could not be exercised in this pass — this sandbox's browser
  automation has no OS file-picker, and the service key isn't set yet. All
  test records deleted afterward.
- Docs updated: CHANGELOG, DECISIONS (D-015), DATABASE (Phase 4 section
  resolved, `projects` moved out of "cross-cutting"), `.env.example` (both
  root and `apps/web`) with `SUPABASE_SERVICE_ROLE_KEY` and
  `NEXT_PUBLIC_APP_URL`.
- **Not done in this pass**: actually setting `SUPABASE_SERVICE_ROLE_KEY`
  (user action), asset drag-reordering (position defaults to 0, sorted by
  created_at — fine for v1), Vercel deployment.

## Claude Code handoff continuation — Phase 3 (Services/Bookings/Payments) — 2026-09-23

- **Infrastructure resolved**: user created the `disco-sundays-crm` GitHub
  repo and pushed the local history; verified with a real `git fetch`
  (`origin/main` matches local `main` exactly, all 3 prior commits present).
  User also created the first Supabase Auth account and it was promoted to
  `owner` via the documented one-time manual SQL update (D-003) — verified
  live: signed in, dashboard loads with real (zero) counts, RBAC/RLS confirmed
  working end-to-end for the owner role (see next bullet).
- **Live end-to-end verification of Phase 2** (not just build-passing):
  using the real owner account in a real browser against the live Supabase
  project, created a customer, added/removed a tag, added/deleted a note,
  edited the customer, created a lead, and converted it to a customer —
  every step produced the correct database row and the correct timeline
  activity, confirming the `activities` RLS fix (D-012) actually works, not
  just compiles. All test records were deleted afterward — nothing left in
  the production database beyond what a real user creates going forward.
- **Database**: applied `0006_phase3_services_bookings_payments.sql` —
  `services`, `booking_statuses`, `bookings`, `payments`, `refunds`,
  `webhook_events`. Extended the `activities` insert policy to cover
  bookings the same way customers already were. Advisors re-ran clean
  (only the two pre-existing accepted warnings plus one new one: Supabase's
  leaked-password-protection toggle, a Dashboard setting, not a migration —
  see D-014's open-questions note).
- **Services**: full CRUD application UI (list, create, edit, archive).
- **Bookings**: full CRUD application UI — customer/service/staff pickers,
  configurable status, payment status; every create/update/cancel writes a
  customer timeline activity. No live Square sync yet (no credentials, per
  `docs/INTEGRATIONS.md`) — bookings are entered directly in the CRM for now,
  honestly labeled as such in the UI.
- **Payments**: read-only application UI. Per D-014, the `payments` table has
  no insert policy for authenticated users — a payment record can only ever
  come from a future Square/Shopify webhook handler, never fabricated by
  staff. Shows an honest empty state, not a fake "add payment" form.
- **Verification**: build/typecheck/lint all pass. Every new flow
  (service create, booking create against a real customer + service) was
  exercised live in the browser against production Supabase and confirmed
  correct, then cleaned up.
- **Not done in this pass**: Square/Shopify webhook handlers (blocked on
  credentials, architecture is ready per D-014), Vercel deployment.

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
