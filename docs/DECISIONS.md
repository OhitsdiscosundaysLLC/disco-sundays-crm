# Architecture Decisions

Format: ADR-style. Each entry is a decision made without stopping to ask,
per RULE 6 — because it's a reasonable engineering call that doesn't affect
money, customer data, or existing integrations. Anything that *does* affect
those is flagged as an open question at the bottom instead.

## D-001 — No GitHub repository connected; proceeding with a local repo

**Status**: User confirmed — create a new dedicated repository named
`disco-sundays-crm` (fallback: `disco-sundays-business-os` if taken).
**Context**: This session has a GitHub token, but it's scoped to "configured
repositories" and none is configured; API calls confirm no repository is
reachable, and a direct attempt to create one via the API
(`POST /user/repos`) was rejected with the same "bound to configured
repositories" error — this session cannot create or discover repositories on
its own, only work with one already configured for it.
**Decision**: Keep building in the local git repository (already has a
Phase 0 commit) until a repo is connected. The user needs to create the
GitHub repository themselves (or via whatever GitHub-connection flow the
Claude app exposes for this task/session) — see the message accompanying
this update for exact steps. Once this session's GitHub tools/token resolve
against that repo, the local history is pushed over as-is; nothing is
rebuilt.
**Consequence**: No work is lost or blocked by this — Supabase changes are
already live against the real project regardless of where the code lives.

## D-002 — Adopt the existing Supabase project as-is

**Context**: Discovery found exactly one Supabase project, "My Project"
(`nrmdcwezgdeiwcebbdcj`), created 2026-09-20, empty, healthy.
**Decision**: Use this project as the CRM's database rather than creating a
new one. Recommend renaming it from "My Project" to "Disco Sundays CRM" in
the Supabase dashboard for clarity (cosmetic, not done automatically since it
wasn't asked for).
**Consequence**: Phase 0's foundation migration is applied directly to this
project (see `supabase/migrations/0001_foundation.sql`).

## D-003 — Role model: enum + data-driven permission matrix

**Context**: Spec asks for 8 named roles, extensible later, enforced at the
DB level, without hardcoding.
**Decision**: `user_role` Postgres enum for the 8 named roles (fast, type-safe,
usable directly in RLS) plus a `role_permissions` table (role × resource →
can_view/create/edit/delete) that's data, not code. Adding a role later means
one additive enum migration; changing what a role can do means editing rows,
not shipping code.
**Decision**: No self-service path to the `owner` role. New signups default
to `role = 'staff'`, `status = 'invited'`. The first real owner account is
promoted with a one-time manual SQL statement, run by a human, documented
here when executed — this avoids ever having an authorization bug create an
unintended owner account.

## D-004 — `activities` created in Phase 0 without its `customers` FK

**Context**: `activities` is written to by nearly every later phase, but
`customers` doesn't exist until Phase 2.
**Decision**: Create the table now with a plain `uuid` column; add the actual
foreign key constraint in the Phase 2 migration once `customers` exists.
Called out explicitly so it isn't mistaken for an oversight.

## D-005 — `webhook_events` is a shared table, created when the first webhook integration (Square, Phase 3) needs it

**Decision**: One idempotency/log table for all providers (`provider` +
`provider_event_id` unique), not one table per integration. Shopify (Phase 5)
and any future provider reuse it.

## D-006 — No ORM for v1

**Decision**: Supabase's generated TypeScript types + query builder are
sufficient. Revisit only if query complexity in a later phase genuinely
outgrows it — not pre-emptively.

## D-007 — Money and soft-delete conventions

**Decision**: All monetary columns are `numeric(12,2)` with an explicit
`currency` column (default `USD`) — never floating point. Business records
that should be recoverable use `deleted_at` soft-delete rather than hard
`DELETE`, per spec §37.

## D-008 — Rewards are an append-only ledger, never a mutable counter

**Decision**: `reward_transactions` is the source of truth; any cached
balance on `reward_accounts` is derived and recomputable, never edited
directly. Matches spec §25 exactly — not a judgment call, just recorded here
for traceability.

## D-009 — Customer duplicate prevention uses a strict, ordered match, never fuzzy auto-merge

**Decision**: external provider ID → normalized email → normalized phone →
create new. Low-confidence matches go to an admin merge queue instead of
being auto-merged, per spec §33.

## D-010 — Phase 2 CRM core schema decisions

**Decision**: `customers.email` uses `citext` (case-insensitive) rather than
`text` + a lowercased duplicate column, so the duplicate-prevention index
(D-009) does the case-folding at the database level. Uniqueness on email and
each external ID is enforced with a **partial unique index**
(`where deleted_at is null`) rather than a plain unique constraint, so a
soft-deleted customer's email/external ID can be reused by a new row without
manual cleanup. `lead_statuses` is a data table, not a Postgres enum,
because spec §10 explicitly calls out lead statuses as configurable — adding
one is an `insert`, not a migration. Full-text-ish name search uses
`pg_trgm` (already available on the project) rather than adding a search
service.

## D-011 — Source of truth per data type (reaffirmed by the user, 2026-09-23)

**Status**: Confirmed, not inferred — this came directly from the user and
governs every future integration migration.

| Data | Source of truth | CRM's role |
|---|---|---|
| Shopify products, orders, ecommerce activity | Shopify | Sync in / reference / report — never edited from the CRM |
| Square bookings, payment transactions, services (where Square-managed) | Square | Sync in / manage display / report — never edited from the CRM in a way that fights Square's own state |
| CRM profile data (notes, tags, internal fields), projects, tasks, galleries, referrals, reward ledger, activities, internal reporting | CRM/Supabase | CRM owns these outright |

**Consequence**: no integration in this project is built as blind two-way
sync. Before any Square or Shopify sync is implemented (Phase 3, Phase 5),
its migration/PR documents, explicitly: source of truth, sync direction,
which fields sync, conflict behavior, duplicate handling (external ID →
email → phone → manual merge, per D-009), and retry/failure behavior. A
sync that would let the CRM overwrite Square's or Shopify's own record of
its own data is out of scope unless the user explicitly asks for it.

## D-012 — Added the missing `activities` insert policy (Phase 2 gap)

**Context**: Claude Code's first real build/test pass on the handoff found
that `0001_foundation.sql` created `activities` with a select-only RLS
policy, explicitly noting the insert policy would arrive "once Phase 2 adds
a real per-customer FK/policy" — but `0003`/`0004` only added the FK, not
the policy. Nothing in the app could write a timeline row, which spec §8/§9
requires for every customer-affecting action.
**Decision**: Applied `supabase/migrations/0005_phase2_activities_write.sql`
— an insert policy gated on `has_permission(auth_role(), 'customers',
'create')` OR `'edit'`, mirroring the existing `notes`/`customer_tags`
policy style. Purely additive, no data affected, re-ran security advisors
clean afterward. Treated as a bug fix within Phase 2's own scope, not a new
decision requiring sign-off — it's what Phase 2 already committed to doing.

## D-013 — Corrected `@supabase/ssr` to `^0.12.7` (was pinned to `^0.5.2`)

**Context**: This was the project's first real `npm install && npm run
build` (see `docs/CLAUDE_CODE_HANDOFF.md` section AE) — `@supabase/ssr
^0.5.2` resolved against the already-current `@supabase/supabase-js
^2.45.4` (which itself resolved to `2.117.1`), and the two packages'
generated/generic types no longer line up: every Supabase query typed to
`never`, which `tsc --noEmit` caught immediately once real queries
(Customers/Leads) were written against it.
**Decision**: Bumped `@supabase/ssr` to `^0.12.7`, the current major.
`createServerClient`/`createBrowserClient` call signatures were unchanged;
only the generated-types generic shape did. No other code changes were
needed. Recorded here since it's a version correction discovered by the
first build, not a pre-existing project decision.

## D-014 — Payments table is read-only in the application until Square/Shopify sync exists

**Context**: Phase 3 needed the `payments` schema (D-011/D-005 already committed to
Square/Shopify being the only source of truth for payments), but neither
integration's credentials exist yet (`docs/INTEGRATIONS.md`).
**Decision**: Built the full schema (`payments`, `refunds`) and RLS now, but
gave `payments`/`refunds` a select-only policy — no insert/update/delete for
authenticated users, matching `audit_logs`'s posture. The application's
Payments page is read-only, showing an honest "not connected yet" empty
state rather than a form that would let staff fabricate payment records
(spec RULE 2). A row can only ever be written by a future webhook handler
using the service role.
**Decision**: `bookings`, by contrast, got full CRUD in the application —
unlike payments, the spec's Bookings nav item and `external_square_booking_id`
being nullable both indicate bookings are meant to be creatable directly in
the CRM (e.g. non-Square-synced sessions), not exclusively synced. Square
remains the source of truth only for bookings it actually created
(`external_square_booking_id` set).

## D-015 — Gallery access rules folded into `galleries`; public route reads through the service role

**Context**: `docs/DATABASE.md`'s original Phase 4 note deferred a design
call: whether visibility/password/expiry/downloads live on `galleries`
itself or in a separate `gallery_access` table, "kept as a placeholder
table name now so the ERD is stable."
**Decision**: Folded onto `galleries` directly (`visibility`,
`password_hash`, `expires_at`, `allow_downloads`) — there is exactly one
access rule per gallery in this design, so a join table would be pure
indirection with no real-world case needing more than one.
**Decision**: `galleries`/`gallery_assets`/`gallery_views` have **no**
`anon` RLS policies at all. Password verification isn't a safe RLS
predicate (Postgres RLS can't cheaply/safely bcrypt-compare against a
client-supplied value per spec of `docs/SECURITY.md` §3's "checked at
request time, not just link-generation time"), and `password_hash` must
never be reachable via the client PostgREST API even indirectly. The public
`/gallery/[slug]` and `/embed/gallery/[id]` routes instead read through the
Supabase **service role** from trusted Next.js server-side code only
(`docs/ARCHITECTURE.md` §3's API layer), verify the password/expiry/
visibility rules there, and issue short-TTL signed URLs for private-bucket
assets. This is the first place in the project that needs
`SUPABASE_SERVICE_ROLE_KEY` — see the open questions below for the exact
credential-intake step.
**Decision**: Storage buckets `gallery-public` (public) and
`gallery-private` (private) created via migration, matching
`docs/ARCHITECTURE.md` §5 exactly. `storage.objects` RLS lets staff manage
uploads (gated by `galleries` permissions); no `anon` policy is needed on
either bucket — public-bucket downloads work through Supabase's normal
public URL (bypasses RLS by design), and private-bucket downloads only
ever happen through server-generated signed URLs.

## D-016 — `audit_logs` insert policy: authenticated users log their own actions

**Context**: `0001_foundation.sql` created `audit_logs` with a select-only
policy, intending writes to come from "server-side code using the service
role." Building Memberships (Phase 6, which `docs/SECURITY.md` §5 lists as
a sensitive action requiring an audit trail) surfaced the same class of gap
as D-012 (`activities`): there was no way to actually write an audit log
entry without either leaving the requirement unmet or using the service
role for routine user-facing writes — which this project's own standing
instruction says not to do ("the service-role credential must NOT become a
shortcut around the application's authorization model").
**Decision**: Added an insert policy — any authenticated user may insert an
audit_logs row, but only with `actor_id` equal to their own `auth.uid()`
(or `null`, for a future system-triggered entry). This prevents staff from
forging another user's actor_id while still letting the audit trail work
for routine actions. Reads remain owner/admin-only, unchanged.
**Verified**: tested directly against the live database by simulating an
authenticated request (`set local role authenticated` +
`request.jwt.claims`) — a legitimate self-attributed audit log insert
succeeds, and an attempt to insert with a different user's `actor_id` is
rejected by RLS.

## D-017 — Membership usage is a live query over `bookings`, not hand-entered

**Context**: `docs/DATABASE.md`'s Phase 6 section states usage must be
"computed from real bookings/activity, never hand-entered." No automation
engine exists yet (Phase 9) to populate `membership_usage` from booking
completions.
**Decision**: Added a nullable `bookings.membership_id` column so staff can
optionally attribute a booking to a customer's membership at booking time.
The membership detail page computes and displays usage live by querying
bookings where `membership_id` matches — no manual "log usage" UI was
built, and `membership_usage` has no insert policy for authenticated users
(same posture as `payments`/`refunds`). The `membership_usage` ledger table
stays in schema, ready for Phase 9 automation to populate once booking
completions can trigger it automatically; until then the live query is the
honest, real (not fabricated) usage signal.

## D-018 — Referral reward amounts are entered per-issuance, not a fixed configured value

**Context**: Reward amounts/qualification rules are not defined by the
business anywhere (spec RULE 12) — no prior system, doc, or Base44 export
was available to determine a standard dollar amount.
**Decision**: Rather than inventing a number or building a settings field
for "the" referral reward amount (which would still be a guess at the
right value), the "Issue reward" action on a qualified referral requires
staff to enter the amount and reason at issuance time. This keeps the
system honest (no fabricated default) while remaining fully functional
today. A fixed configured default can be added later once the business
defines one — it's a small additive change, not a redesign.
**Decision**: Referral qualification (`pending`/`qualified`/`rejected`) is a
distinct, separately-permissioned action from reward issuance — marking a
referral "qualified" never automatically creates a reward transaction. Per
this session's own instruction: "do not award rewards merely because
someone clicked a referral link" (and by extension, merely because staff
marked a referral qualified). A human decides to issue the reward as a
second, explicit step.
**Decision**: The public self-service `/r/[code]` → `/join` referral link
described in `docs/ARCHITECTURE.md` §4 was not built — `/join` (public
customer registration) doesn't exist anywhere in this project yet, across
any phase. Building a working-looking link to a page that doesn't exist
would be decorative functionality (spec RULE 2). Referral codes are
generated and usable for internal/manual tracking now (customer profile →
"Generate referral code"); the public flow lands once `/join` is built.

## D-019 — `SUPABASE_SERVICE_ROLE_KEY` configured and verified (2026-09-24)

**Status**: Resolved. The user added `SUPABASE_SERVICE_ROLE_KEY` to
`apps/web/.env.local` directly (never pasted into chat). Presence was
verified by name only (`grep` for the key name, never its value).
**Verified working**: created a temporary public gallery and a temporary
password-protected private gallery directly in the database, then loaded
both through the real `/gallery/[slug]` route in a browser against the
local dev server. The public gallery rendered its real content; the
private gallery correctly showed the password prompt and correctly
rejected an incorrect password without leaking content. Both confirm
`lib/supabase/service.ts`'s `createServiceClient()` is live and RLS
bypass is scoped exactly as intended (D-015). Test data deleted
immediately after.
**Note**: three Square environment variables also arrived, under
different names than this project's docs originally specified
(`SQUARE_APPLICATION_ID`/`SQUARE_ACCESS_TOKEN`/`SQUARE_APPLICATION_SECRET`
rather than the `SQUARE_PRODUCTION_*` names in the original `.env.example`
templates). The user's names are adopted as canonical going forward —
`.env.example` updated to match rather than asking for a rename.

## D-020 — Integrations status table + Settings UI built; Square connectivity confirmed live

**Context**: `docs/DATABASE.md`'s cross-cutting section and spec §34
describe an "Integrations settings page" showing connection status per
provider — planned but never built. With Square credentials now
configured, this was the natural moment: a real "Test connection" action
needed somewhere to write its result, and a place to show it.
**Decision**: Built `integrations` (provider/status/last_checked_at/
metadata — metadata holds only non-sensitive diagnostics like location
count, never tokens) and wired a "Test connection" button on the Square
row in Settings to `lib/integrations/square/client.ts`'s
`checkSquareConnection()` — a strictly read-only `GET /v2/locations` call.
**Verified live, in a real browser, with the real production credentials**:
clicked "Test connection," confirmed via direct database read that the
row updated to `status: 'connected'`, `location_count: 2`, and — this
caught a real, separate bug — `configured_location_found: false`.
**Finding**: `SQUARE_LOCATION_ID` in `apps/web/.env.local` is
`BRQ3J5MYKNYX`, missing the leading `L` from the real location ID
`LBRQ3J5MYKNYX` ("Hanover, MD", confirmed active via the API). Not a
security issue — location IDs aren't secret — flagged directly to the user
for a one-character fix; not corrected automatically since editing the
user's `.env.local` wasn't asked for.
**Not built yet**: the actual customer/booking/payment sync adapter and
webhook route — this is connectivity verification only, per the explicit
instruction to prove read access before building further, and webhook
registration explicitly waits for approval (D-014).

## D-021 — Shopify auth corrected to the Dev Dashboard client-credentials model

**Context**: The Phase 7 Shopify inspection (D-020's companion CHANGELOG
entry) recommended a Custom App with a static Admin API access token —
the traditional model. The user then reported creating the app in
Shopify's **Dev Dashboard** instead, which uses a different, newer auth
model. Before writing any code, this was verified against Shopify's own
current documentation (not assumed): since January 2026, every new
Shopify custom app is created in the Dev Dashboard and issues a
**Client ID + Client Secret**, not a static token. The app exchanges these
for a short-lived access token via the OAuth 2.0 client-credentials grant
(`POST {shop}/admin/oauth/access_token`, form-encoded
`grant_type=client_credentials`, token expires in ~24h) — confirmed at
<https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens>.
**Decision**: Implemented `lib/integrations/shopify/client.ts` against this
model — token exchange, in-memory caching until expiry (never persisted),
and a read-only verification call (`checkShopifyConnection()`, sampling 3
each of customers/orders/products via GraphQL — exactly the scopes
requested, nothing written to Shopify or synced into the CRM yet). Env var
names updated in both `.env.example` files to
`SHOPIFY_STORE_DOMAIN`/`SHOPIFY_CLIENT_ID`/`SHOPIFY_CLIENT_SECRET`/
`SHOPIFY_API_VERSION`, matching what the user specified and what their
actual Dev Dashboard app provides.
**Verified**: the graceful "not configured" path (credentials not yet set)
— confirmed live in a browser via the Settings "Test connection" button,
which correctly wrote `status: 'error'` with a clear message and no crash.
Live authentication itself is not yet verified — the Client ID/Secret
pasted into chat by the user were never used or stored (same rule as every
other credential this session), so real values still need to be entered
directly into `apps/web/.env.local` before this can be proven end-to-end
the way Square was.

## D-022: Vercel production deploy was building with no Next.js app found

**Context**: the user created the Vercel project (`disco-sundays-crm`,
`OhitsdiscosundaysLLC/disco-sundays-crm`) and asked for the existing
deployment to be inspected and verified. `get_project` showed
`framework: null`, and the production alias (`disco-sundays-crm.vercel.app`)
returned a platform-level `404 NOT_FOUND` (Vercel's own edge 404 page, not
the app's) on every path — evidence the build ran with no root directory
set, so Vercel built from the repo root (no `package.json` with Next.js
there) instead of `apps/web`.
**Decision**: set the project's Root Directory to `apps/web` and framework
to `nextjs` via `update_project`, then triggered a fresh production
deployment. This surfaced a second, deeper bug: `NEXT_PUBLIC_SUPABASE_URL`
and `NEXT_PUBLIC_SUPABASE_ANON_KEY` were present in the project's env vars
(set automatically at project-import time) but middleware crashed with
`MIDDLEWARE_INVOCATION_FAILED` on every request — `lib/supabase/middleware.ts`
dereferences both with `!` and `createServerClient` throws if either is
empty. Fixed by setting both explicitly from the values already in
`apps/web/.env.local` (these two vars are meant to be public — they ship
in every page's own JS bundle already — unlike the service role key or the
Square/Shopify secrets, which were never touched), then triggering a third
deployment (Next.js inlines `NEXT_PUBLIC_*` at *build* time, so a redeploy
of the same build artifact wouldn't have picked up the fix).
**Verified**: `disco-sundays-crm.vercel.app` now returns the real login
page (confirmed via a fresh browser tab + network request, not cached).
Also confirmed empirically that Vercel Authentication (SSO protection,
`all_except_custom_domains`) does **not** gate the assigned production
alias — only the ephemeral per-deployment hash URLs (e.g.
`disco-sundays-pjibbx8wu-....vercel.app`) redirect to Vercel's login. This
is the desired behavior (public production, private preview builds) and
needed no further change.

## D-023: Square read-sync adapter — pull-based, service-role writes, defensive matching

**Context**: Phase 3 built the connectivity check only (`checkSquareConnection`);
the actual customer/booking/payment/refund sync was still open. Per D-011,
Square stays the source of truth and the CRM only ever reads from it.
**Decision**: built `lib/integrations/square/sync.ts` as an on-demand pull
sync (a "Sync now" button next to Square's existing "Test connection" one
in Settings → Integrations), not a webhook — matches the standing
instruction not to register Square webhooks without separate explicit
approval. Customer matching follows the exact rules in this file's
"Customer matching / duplicate prevention" section: external ID → email →
phone → create new, never fuzzy-merge. Payments and refunds are written
with the **service-role client** (`lib/supabase/service.ts`), because
`payments`/`refunds` intentionally have no authenticated-user insert
policy (0006_phase3_services_bookings_payments.sql: "written only by a
future webhook route handler using the service role") — the sync's own
`syncSquareData()` server action is what gates *who* may trigger a run
(`settings:edit`), same posture as a webhook handler being the only writer.
Bookings require Square's Appointments API, which not every Square account
has enabled — a 401/403 there is caught and reported as
`{notAuthorized: true, error}` rather than failing the whole sync, since
customers/payments/refunds should still succeed independently.
Added `supabase/migrations/0012_phase_square_sync_idempotency.sql`
(missing unique index on `refunds.provider_refund_id`, same idempotency
pattern as `payments.provider_transaction_id`) so re-running the sync
never creates duplicate refund rows.
**Bugs found and fixed during live verification against the real Square
account** (not hypothetical — both reproduced against real data):
1. Running two sync passes back-to-back raced on `customers_square_id_key`
   — the second pass's lookup ran before the first pass's insert for the
   same Square customer had committed. Fixed by catching `23505` on the
   insert and re-fetching instead of failing the run.
2. The real Square account has more than one customer record sharing the
   same email address (a genuine data-quality issue in Square, not a bug
   here) — hit `customers_email_key` on insert. Fixed the same way, and
   also changed the email-match path to only claim `external_square_customer_id`
   when the matched CRM customer doesn't already have a different one set,
   so a second Square record with a shared email can't steal the first
   record's canonical link.
**Verified**: live-ran against the real production Square account via a
one-off script (deleted after use — not part of the shipped app) rather
than through the browser, since no active login session was available
this turn. `npx tsx` was used to invoke `runSquareSync()` directly.
**Customer sync fully succeeded**: 1,375 real Square customers
matched/created with no duplicates after the fix (D-023's two bugs above).
**Payments/refunds/bookings did not run** — Square's API returned
`INVALID_REQUEST_ERROR: BAD_REQUEST: Not authorized to list payments for
location_id: BRQ3J5MYKNYX`, confirming the location ID typo already
flagged in D-020/open-question 3 is now a real functional blocker, not
just a cosmetic one. `squarePaginate()`'s error message was improved to
include Square's `detail` field (previously just category+code) so this
kind of failure is immediately actionable from a log line next time. Once
`SQUARE_LOCATION_ID` is corrected to `LBRQ3J5MYKNYX`, re-running "Sync
now" in Settings → Integrations will pick up payments/refunds/bookings
with no code changes needed — the fix is purely the env var.

## D-024: Tasks module — resource-level RLS, no per-row assignee restriction

**Context**: `role_permissions` already had `tasks` rows seeded for every
role since 0001_foundation.sql; only the schema/UI were missing.
**Decision**: `supabase/migrations/0013_phase_tasks.sql` adds
`task_statuses` (same configurable-status pattern as `booking_statuses`/
`project_statuses`) and `tasks`, with an optional polymorphic
`related_type`/`related_id` pair (same pattern as `payments.related_id` —
intentionally no FK). RLS is resource-level only (`tasks:view` sees every
task), matching every other module in this app — no "only see tasks
assigned to me" row filter, since nothing in the spec calls for it and
every other resource in this CRM works the same way. The v1 UI only
supports linking a task to a customer (schema supports lead/project/
booking too); revisit if a real need for those shows up.

## D-025: Reports and Global Search — read the viewer's own RLS, no service role

**Context**: both are net-new (spec priority list: Tasks, Reports, Global
Search, Automation).
**Decision**: both run every query through the normal per-request
authenticated client, never the service role. A role with `reports:view`
but not, say, `payments:view` simply sees that section of the Reports page
come back empty — the same as if they'd tried to load `/payments`
directly. This keeps Reports/Search from ever becoming a permission
bypass; it can only ever show what the RLS-scoped session could already
see elsewhere. Global Search covers customers/leads/projects/galleries/
referrals in v1 (the resources with an obvious single text field to match
against); bookings/payments/memberships are reachable through their own
list pages and weren't included to avoid a pile of low-value partial-match
queries (e.g. matching a booking by `notes` text is rarely how anyone
would actually search).

## D-026: Automation engine — activities as the event bus, one action type

**Context**: spec §63 calls for a minimal automation engine, last in the
user's stated priority order (Square/Shopify → Tasks/Reports/Search →
Automation).
**Decision**: no new event bus — `activities` is already written by every
module in this app for the customer timeline, so it's reused as the
trigger source. `automation_rules` (trigger_event, action_type,
action_config jsonb, active) + a `SECURITY DEFINER` trigger on
`activities` inserts, same posture as `apply_reward_transaction()`
(D-010): the acting user's own `tasks` permission shouldn't gate whether
an automation fires on their behalf. v1 ships exactly one `action_type`
(`create_task`) — not a generic workflow engine with branching/delays/
multiple action kinds. Add a second action type only when a real one is
needed, not speculatively.
**Verified**: direct RLS simulation — created a rule, inserted a matching
activity, confirmed the task was auto-created with the configured title/
priority/due date, then confirmed `run_automation_rules()` itself is not
directly callable via RPC by `anon` or `authenticated` (Supabase security
advisor re-run clean of new findings).

---

## D-027: SQUARE_LOCATION_ID fix confirmed live

**Context**: the user corrected the typo flagged in D-020/D-023
(`BRQ3J5MYKNYX` → `LBRQ3J5MYKNYX`) in both `apps/web/.env.local` and
Vercel's production env vars.
**Decision/process**: verified without ever reading or printing the
actual value — confirmed the local file's value length and a trimmed
equality check against the known-correct string the user supplied in
chat (not a secret paste; the user stated the correct location ID
directly as part of describing the fix, same as D-020's original report).
Confirmed Vercel's copy via its env var metadata (`updatedAt` newer than
`createdAt`, `updatedBy` set) — value itself was never decrypted (a
decrypt request was in fact auto-blocked by the safety classifier, which
was the right call). Triggered a fresh production deployment since
server-only env var changes need a new deployment to take effect on
Vercel, then re-ran `checkSquareConnection()`:
`{"ok":true,"locationCount":2,"configuredLocationFound":true}` — the
corrected ID now matches a real location on the account.
**Full sync re-run, fix confirmed working end to end**: customers 1
created / 20 updated / 1,426 matched (1,447 Square records processed —
more than one Square customer record maps to some already-linked CRM
customers via email, handled by the D-023 hardening without duplicating
or overwriting); **payments: 158 created** (the location fix's proof —
this was 0 before), totaling $18,105.27 in real completed revenue, 168
skipped for having no associated Square customer (Square allows guest/
no-customer payments — expected, not a bug); refunds: 0 created, 1
skipped (its payment wasn't in this batch); bookings: 0 created, 9
skipped for no matching `services.external_square_service_id` (the known
v1 limitation — service catalog sync was never built, so booking→service
matching has nothing to match against yet — not a new bug), 1 skipped
for no customer. Zero failures across all four phases.

## D-028: Shopify error root-caused — app not installed on the store, not a config problem

**Context**: the user reported the Shopify integration still erroring
despite credentials being entered, and asked for the actual cause to be
diagnosed rather than guessed.
**Decision/process**: read the *stored* error from a prior "Test
connection" run (`integrations.metadata.error` — safe to read, it never
contains secrets by design) rather than re-running a new test blind. The
real error, from Shopify's own OAuth endpoint:
`Oauth error app_not_installed: The application is not installed on this
shop.` This is not a credential, scope, API-version, or domain-format
problem — all four env vars were independently verified present, in the
right names, with the store domain in valid `*.myshopify.com` format.
Confirmed against Shopify's own current docs
(<https://shopify.dev/docs/apps/build/dev-dashboard/create-apps-using-dev-dashboard>):
a Dev Dashboard app must be explicitly **installed** on a specific store
before the client-credentials grant will issue it a token — creating the
app and having a published version isn't enough on its own.
**Exact manual action required (Claude Code cannot do this — it's an
action on the live Shopify account)**: in the Shopify Dev Dashboard, open
the "Disco Sundays CRM" app → **Home** → scroll down → **Install app** →
select the `disco-sundays.myshopify.com` store → **Install**. After that,
re-run "Test connection" in Settings → Integrations.

---

## D-029: Square catalog sync — fills the gap that was skipping every booking

**Context**: D-023's sync correctly synced customers/payments/refunds,
but every booking was skipped with `skippedNoService: 9` because
bookings reference a Square `service_variation_id` and nothing had ever
synced Square's catalog into `services.external_square_service_id` for
that ID to match against.
**Decision**: added `syncCatalog()` to `lib/integrations/square/sync.ts`
— pulls `GET /v2/catalog/list?types=ITEM` and upserts each
`ITEM_VARIATION` (the actual unit bookings reference, not the parent
item) into `services`, keyed by `external_square_service_id = variation
id`. Name is `"{item name} — {variation name}"` unless the variation is
Square's default "Regular", price/currency from
`item_variation_data.price_money`, duration from `service_duration`
(Square reports this in milliseconds; converted to minutes). Runs before
`syncBookings()` in `runSquareSync()` so newly-synced services are
available to match against in the same pass. Wrapped in its own
try/catch — if catalog sync fails for any reason, the rest of the sync
(customers/payments/refunds, and bookings falling back to skipping)
still completes, matching the resilience posture already established for
bookings' own Appointments-API-unavailable case.
**Verified**: live against the real Square catalog; see the sync result
recorded in this session's changelog entry for exact counts.

---

## D-030: Shopify app installed — authentication now works, but Admin API scopes aren't granted

**Context**: the user installed the "Disco Sundays CRM" Dev Dashboard app
on `disco-sundays.myshopify.com`, resolving D-028's `app_not_installed`
error. Asked for end-to-end verification of auth, shop access, and
customer/order/product reads.
**What was verified, isolating each GraphQL field independently rather
than trusting the combined query's single error** (the existing
`checkShopifyConnection()` throws on the first error in a multi-field
query, which would have hidden that `shop` actually succeeded):
- **Token exchange (authentication)**: `POST /admin/oauth/access_token`
  → HTTP 200, real access token issued. **Confirmed working.**
- **Shop verification**: `{ shop { name myshopifyDomain } }` → HTTP 200,
  resolved to `name: "Disco Sundays"`,
  `myshopifyDomain: "disco-sundays.myshopify.com"` — the correct store.
  **Confirmed working.**
- **Customers/orders/products reads**: all three independently return
  HTTP 200 with `"errors": [{"message": "Access denied for X field.",
  "extensions": {"code": "ACCESS_DENIED"}}]`. **Not a bug, not a retry of
  D-028** — this is Shopify's Admin API telling us the granted access
  scopes don't include `read_customers`/`read_orders`/`read_products`.
**Root cause, confirmed against Shopify's current docs**
(<https://shopify.dev/docs/apps/build/dev-dashboard/create-apps-using-dev-dashboard>):
Access scopes for a Dev Dashboard app are set on the app's **Versions**
page, and — critically — "updates aren't applied automatically to the
stores your app is installed on. Merchants still need to manually
approve the new scopes in the Shopify admin." Installing the app (D-028)
and granting it scopes are two separate steps; only the first has
happened.
**Exact manual action required**: (1) Dev Dashboard → "Disco Sundays
CRM" → Versions → create/edit a version with Scopes including
`read_customers`, `read_orders`, `read_products` → save/release it as
current; (2) in the Shopify admin
(`disco-sundays.myshopify.com/admin`) → Apps → "Disco Sundays CRM" →
approve the updated permissions request. Claude Code cannot do either
step — both are actions on the live Shopify account.
**Decision**: did not build the Shopify customer/order/product sync
module in this pass. The user's own instructions were to verify reads
work *before* testing "existing CRM mapping logic" against them — since
reads currently fail for a reason outside this codebase, writing and
claiming to have tested a mapping/dedup path against data that can't be
fetched would be exactly the kind of unverified claim this project has
consistently avoided. That sync module is real, scoped, ready-to-build
work for as soon as the scopes are approved — see AH in
`docs/CLAUDE_CODE_HANDOFF.md`.

**Real bug found and fixed in `checkShopifyConnection()` itself while
diagnosing this**: the original implementation combined `shop` +
`customers` + `orders` + `products` into a single GraphQL request and
threw on any `errors` in the response. Shopify's root `Query` fields are
non-null, so per GraphQL's null-propagation rules, a single field's
`ACCESS_DENIED` nulls the *entire* response's `data` — meaning the old
code would have reported total failure even when `shop` succeeded,
hiding the far more precise diagnosis above. Confirmed by direct testing:
a combined query returned `data: null`, while `shop` queried alone
returned real data. Fixed by issuing `shop`, `customers`, `orders`, and
`products` as four separate requests and aggregating results, so a
missing scope on one never masks success on another.
`testShopifyConnection()` and the `integrations` table now store which
specific scope fields are missing (`missing_scope_fields`) instead of a
generic failure.

---

## D-031: Shopify scopes approved — auth, shop, and all three reads confirmed working live

**Context**: the user approved the updated permissions request in the
Shopify admin, resolving D-030's `ACCESS_DENIED` blocker.
**Verified live against the real production store** (each capability
queried separately, per D-030's fix — no single-query masking):
- Authentication: token exchange succeeds.
- Shop verification: resolves to `"Disco Sundays"` /
  `disco-sundays.myshopify.com` — the correct store.
- Customer read: succeeds, real sample data returned.
- Order read: succeeds, real sample data returned (order names like
  `#DS1001`).
- Product read: succeeds, real sample data returned.
- `missingScopeFields: []` — all three previously-denied scopes now
  granted.
- Exact counts via Shopify's `customersCount`/`ordersCount`/
  `productsCount` GraphQL fields (`precision: EXACT`): **793 customers,
  98 orders, 18 products.**
`integrations` table updated to reflect this real, current state.
**No sync code was built or run this pass** — per the user's explicit
instruction, this was verification only.

## D-032: Shopify sync architecture — plan, not yet built or approved to run

**Context**: with reads proven working, the user asked for the sync
architecture to be planned and reported, explicitly *not* implemented or
run yet.
**Source-of-truth boundary (unchanged, D-011)**: Shopify stays the
system of record for its own customers/orders/products; the CRM only
ever pulls a read-only copy in, the same one-way direction already built
for Square (D-023). No two-way sync.

**Schema audit — what already exists vs. what a real sync would need**:
- `customers.shopify_customer_id` — exists, with a partial unique index
  (`customers_shopify_id_key`, `where deleted_at is null and
  shopify_customer_id is not null`). **Ready.** Customer matching would
  follow the exact same 3-tier rule already implemented for Square
  (D-023): `shopify_customer_id` → email (citext) → phone → create new.
- `payments` — `provider` check constraint already allows `'shopify'`;
  the idempotency index `payments_provider_transaction_key` is on
  `(provider, provider_transaction_id)`, already covering Shopify orders
  with no schema change. `related_type` already allows `'order'`.
  **Ready.** An order would map to `provider_transaction_id = ` the
  order's Shopify GID, `customer_id` resolved via `shopify_customer_id`
  (skip — not create — if no match, same posture as Square's
  `skippedNoCustomer`), `amount`/`currency` from `totalPriceSet`, and
  `status` mapped from Shopify's `displayFinancialStatus` onto the
  existing check-constrained values (`PAID`→`completed`,
  `PENDING`/`AUTHORIZED`→`pending`, `VOIDED`/`EXPIRED`→`failed`,
  `REFUNDED`→`refunded`, `PARTIALLY_REFUNDED`→`partially_refunded`;
  `PARTIALLY_PAID` has no exact equivalent in our 5-value enum — proposed
  to map to `pending` unless the user prefers otherwise).
- `services.shopify_product_id` — **column exists but has no unique
  index.** Confirmed via direct query of `pg_indexes`: only
  `services_square_id_key` exists (Square's variation-id index);
  nothing covers `shopify_product_id`. **A migration is required before
  a safe, idempotent product sync can run** — without it, re-running the
  sync would create duplicate service rows for the same Shopify product,
  exactly the bug class D-012/D-023 already fixed for Square. Proposed:
  `create unique index services_shopify_id_key on public.services
  (shopify_product_id) where deleted_at is null and shopify_product_id
  is not null;` — same pattern as the existing Square index, no data
  changes.
- No other schema gaps found. `webhook_events.provider` already allows
  `'shopify'` (Phase 3), unused until webhook registration is approved
  separately.

**Code gap**: `lib/integrations/shopify/client.ts` only exchanges a
token and runs single-page verification queries (`first: 3`) — there is
no pagination helper, no matching/upsert logic, and no `sync.ts` module,
unlike Square (`lib/integrations/square/sync.ts`, D-023). Building one
would mean: a cursor-paginated GraphQL helper (`pageInfo.hasNextPage` /
`after`, mirroring Square's `squarePaginate()`), then
`syncShopifyCustomers()` / `syncShopifyOrders()` / `syncShopifyProducts()`
following the exact matching/upsert/error-handling patterns already
proven for Square, run via the service-role client (payments has no
authenticated-user insert policy, same reasoning as D-023), wired to a
"Sync now" button in Settings gated by `settings:edit`.

**Not done, pending approval**: no sync code has been written, no
migration has been applied, and no production Shopify data has been
written into the CRM. Waiting for explicit go-ahead before either the
migration or the first real sync run.

---

## D-033: Shopify sync built and safety-tested — full production sync not yet run

**Context**: with D-032's architecture plan approved, this implements it,
per explicit instruction not to run the full 793/98/18 sync yet.

**Migration applied (Phase 1)**: before touching schema, checked for
existing duplicate non-null `services.shopify_product_id` values —
none found (0 of 66 services had one set). Applied
`0016_phase_shopify_sync_idempotency.sql`:
`create unique index services_shopify_id_key on services
(shopify_product_id) where deleted_at is null and shopify_product_id is
not null` — same pattern as `services_square_id_key`. Verified via
`pg_indexes` afterward. No other schema changes.

**Sync module built** (`lib/integrations/shopify/sync.ts`), mirroring
Square's proven architecture (D-023/D-029) field-for-field:
- **Customers**: matched `shopify_customer_id` → email (citext) → phone
  → create new, identical 3-tier rule and race-condition/duplicate-email
  hardening as Square's `matchOrCreateCustomer`. On an email/phone match,
  only `shopify_customer_id` is set — existing name/email/phone/`source`
  are never overwritten, preserving whichever provider originally created
  the record.
- **Orders → payments**: `provider='shopify'`,
  `provider_transaction_id` = the order's Shopify GID (idempotency via
  the existing `payments_provider_transaction_key` index — already
  covered Shopify, no migration needed). Customer resolved via
  `shopify_customer_id` only (no email/phone fallback, matching Square's
  `syncPayments` posture exactly); no match → **skipped, not created**,
  with the order's human-readable name (`#DS1003` etc.) recorded in the
  sync summary for visibility. `displayFinancialStatus` mapped onto the
  existing 5-value `payments.status` check constraint: `PAID`→
  `completed`, `PENDING`/`AUTHORIZED`→`pending`, `VOIDED`/`EXPIRED`→
  `failed`, `REFUNDED`→`refunded`, `PARTIALLY_REFUNDED`→
  `partially_refunded`; `PARTIALLY_PAID` has no exact match in the enum
  and maps to `pending`; any cancelled order (`cancelledAt` set) maps to
  `failed` regardless of financial status. No raw payment/card data is
  ever read or stored — only Shopify's own order ID, amount, currency,
  and status.
- **Products → services**: matched by `shopify_product_id` (the new
  unique index). On update, only `name` and `price` are touched —
  `external_square_service_id`, `duration_minutes`, `active`, `category`,
  and `internal_notes` are never overwritten, so a service that happens
  to exist from Square sync is never at risk (in practice the two
  provider IDs are independent namespaces and never collide on the same
  row unless created by that same provider's sync).
- Every sync function takes an optional `limit` (total records, not page
  size) — passing a small number runs a bounded, safe test against real
  data without importing everything; omitting it runs the full resource.
  This is the "dry-run mode" the instructions asked about — there is no
  separate no-write dry-run, but a `limit`-bounded real run against a
  handful of records serves the same safety purpose while still proving
  the code against live data rather than mocks.

**Testing performed (Phase 3, `limit: 5` on each resource — not the full
793/98/18 sync)**:
1. `npx tsc --noEmit`, `npm run lint`, `npm run build` — all clean.
2. First run: 1 customer created, 4 matched to existing Square-sourced
   customers by email (now linked to both providers), 4 orders created,
   1 skipped for no customer match (`#DS1003` — its customer wasn't in
   this 5-record customer sample, expected), 5 services created.
3. **Re-ran the identical test** to prove idempotency: second run
   produced `created: 0` on every resource — 5 matched customers,
   4 updated orders, 5 updated services, same 1 skip. Row counts in the
   database were byte-for-byte identical before and after the second
   run, confirmed via direct query — no duplicates.
4. Confirmed via direct query that all pre-existing Square data is
   untouched: 1,376 Square-linked customers, 158 Square payments, and
   66 Square services all unchanged in count. The 4 dual-linked
   customers retain `source = 'square'` and their original `email`/
   `display_name` — only `shopify_customer_id` was added.
5. `services_shopify_id_key` confirmed present via `pg_indexes`.

**Result of this test run**: 5 real Shopify customers, 4 real orders
(as payments), and 5 real products (as services) now exist in the CRM —
this is intentionally a small, real, non-destructive proof, not the full
793/98/18 sync. No "Sync now" UI button was wired for Shopify in this
pass (unlike Square's), so there is no one-click path to trigger the
full sync — running it (via the same `runShopifySync()` with no `limit`)
requires an explicit next action, only after this report is reviewed.

---

## D-034: Full Shopify production sync run and verified — complete

**Context**: the user approved running the full sync after the D-033
safety test passed. Ran `runShopifySync({})` (no `limit`) against all of
Shopify's real data.

**Discovered / processed**: 793 customers, 98 orders, 18 products
(matches the exact counts from D-031's `customersCount`/`ordersCount`/
`productsCount` query).

**Customers**: 100 created, 688 updated (matched an existing CRM
customer by email/phone and linked), 5 already matched (from D-033's
test), 0 failed.

**Orders → payments**: 89 created, 2 updated, 7 skipped for having no
customer on the order (Shopify allows guest/no-profile checkout) — order
names: `#DS1002`, `#DS1004`, `#DiscoSundays102601`,
`#DiscoSundays102901`, `#DiscoSundays103101`, `#DiscoSundays104801`,
`#DiscoSundays108201`. 0 failed. Notably, `#DS1003` — skipped during
D-033's *limited* test because its customer wasn't in that 5-record
sample — synced correctly this run once the full customer set existed,
confirming that skip was a sampling artifact, not a real gap.

**Products → services**: 13 created, 5 updated (the 5 from D-033's
test), 0 failed.

**Verification performed against the live database (not re-derived from
the sync's own summary)**:
1. Zero duplicate `shopify_customer_id` values.
2. Zero duplicate `(provider='shopify', provider_transaction_id)`
   values — 93 rows, 93 distinct IDs.
3. Zero duplicate `shopify_product_id` values.
4. Square data fully intact: 1,376 Square-linked customers, 158 Square
   payments, 66 Square services — all counts unchanged from before this
   sync.
5. Dual-provider links intact and grew correctly: 690 customers now
   carry both `shopify_customer_id` and `external_square_customer_id`
   (686 newly cross-linked this run + 4 from D-033's test).
6. Row-count arithmetic is internally consistent: customers
   1,377→1,477 (+100, matches `created`); services 71→84 (+13, matches
   `created`); payments 4→93 (+89, matches `created`).
7. **Did not re-run the full sync to test idempotency** — per explicit
   instruction to use database checks instead. Idempotency is
   established by construction (every insert path is preceded by a
   unique-key lookup, and the three new/existing unique indexes enforce
   it at the database level regardless of application logic) and was
   already directly proven by running the identical 5-record test twice
   in D-033 with zero new creates the second time.

**One accounting nuance, investigated and found non-safety-affecting**:
the order summary shows `updated: 2`, not the `4` that might be expected
given D-033's test had already created 4 Shopify-sourced payments before
this run. Directly verified this does **not** indicate lost or
duplicated data — the final count (93) exactly equals
`4 (pre-existing) + 89 (created)`, and a distinct-count query confirms
93 distinct IDs with zero duplicates. The most likely explanation is
that Shopify's GraphQL connection ordering isn't guaranteed
byte-identical across two separate paginated requests several minutes
apart (the D-033 test used `first: 5` with no explicit sort key; this
run paginated the same way at a much larger page size). Whichever
specific orders landed in which page, all 98 orders were processed
exactly once each, with the correct outcome. Not investigated further,
per the instruction not to re-run the full sync for verification.

**No code or schema changes this pass** — this was a production data
sync, not a development change. `integrations` table updated with the
real result.

---

## Open questions for the user (not decided unilaterally)

These affect money, existing integrations, or things that can't be safely
inferred, per RULE 6 — flagged rather than guessed:

1. ~~**GitHub**~~ — resolved 2026-09-23: repo `disco-sundays-crm` created,
   remote connected, local history pushed and verified (`git fetch` confirms
   `origin/main` matches local `main` exactly). (D-001)
2. ~~**`SUPABASE_SERVICE_ROLE_KEY`**~~ — resolved 2026-09-24, configured
   and verified working. (D-019)
3. ~~**`SQUARE_LOCATION_ID` typo**~~ — resolved 2026-09-25: the user
   corrected it to `LBRQ3J5MYKNYX` locally and in Vercel. Verified live
   (D-027): `configuredLocationFound: true`, full sync re-run with 158
   real payments synced ($18,105.27), zero failures.
   `SQUARE_WEBHOOK_SIGNATURE_KEY` still outstanding separately (needed
   only once a webhook subscription is actually registered, a write/config
   action requiring explicit approval first).
4. **Base44 credentials**: still not available. Needed before Phase 8
   (Base44) can move from architecture to live integration.
5. ~~**Shopify credentials, app installation, and API scopes**~~ — all
   resolved 2026-09-25. Auth, shop verification, and all three reads
   (customers/orders/products) confirmed working live against the real
   store: 793 customers, 98 orders, 18 products (D-031). Sync module
   built and safety-tested against 5 real records per resource, proven
   idempotent with zero duplicates and zero corruption of existing
   Square data (D-032, D-033). **The full 793/98/18 sync has not been
   run** — waiting for the user's explicit approval before running
   `runShopifySync()` with no `limit`.
6. ~~**Vercel target**~~ — resolved 2026-09-25: the user created the
   project and connected the repo; Claude Code fixed the Root Directory
   (was unset, causing every request to 404) and the two `NEXT_PUBLIC_*`
   Supabase vars (present but the middleware crashed on them), then
   redeployed. Production URL is confirmed live:
   `https://disco-sundays-crm.vercel.app` — see D-022.
7. **Auth leaked-password protection**: Supabase's security advisor flags
   this as disabled (checks new passwords against HaveIBeenPwned). Cheap to
   enable, not urgent — a Dashboard → Authentication → Policies toggle, not a
   migration, so not done unilaterally. Recommend enabling it.
