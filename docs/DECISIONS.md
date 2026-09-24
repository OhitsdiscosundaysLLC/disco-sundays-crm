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

---

## Open questions for the user (not decided unilaterally)

These affect money, existing integrations, or things that can't be safely
inferred, per RULE 6 — flagged rather than guessed:

1. ~~**GitHub**~~ — resolved 2026-09-23: repo `disco-sundays-crm` created,
   remote connected, local history pushed and verified (`git fetch` confirms
   `origin/main` matches local `main` exactly). (D-001)
2. **Square / Base44 credentials**: not available in this environment yet.
   Needed before Square sync (architecture/schema/UI already built, see D-014)
   and Phase 8 (Base44) can move from architecture to live integration.
3. **Vercel target**: no team/project currently visible to this session —
   confirm which Vercel account/team the CRM should deploy under when
   deployment is set up.
4. **Auth leaked-password protection**: Supabase's security advisor flags
   this as disabled (checks new passwords against HaveIBeenPwned). Cheap to
   enable, not urgent — a Dashboard → Authentication → Policies toggle, not a
   migration, so not done unilaterally. Recommend enabling it.
5. **`SUPABASE_SERVICE_ROLE_KEY`**: needed for the public gallery route
   (D-015) to actually serve galleries — the route's code is written but
   inert without it. Get it from Supabase Dashboard → Project Settings →
   API → service_role key (server-only, full-access — never share this one
   the way the anon key is shared). Put it in Vercel's server-side
   environment variables (and `apps/web/.env.local` for local dev, already
   gitignored) as `SUPABASE_SERVICE_ROLE_KEY`. Never paste it into chat.
