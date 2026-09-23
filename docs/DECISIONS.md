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

---

## Open questions for the user (not decided unilaterally)

These affect money, existing integrations, or things that can't be safely
inferred, per RULE 6 — flagged rather than guessed:

1. **GitHub**: should I create a new repository for this project, or is there
   an existing Disco Sundays repo I should connect to instead? (D-001)
2. **Square / Base44 credentials**: not available in this environment yet.
   Needed before Phase 3 (Square) and Phase 8 (Base44) can move from
   architecture to live integration.
3. **Vercel target**: no team/project currently visible to this session —
   confirm which Vercel account/team the CRM should deploy under when Phase 1
   starts.
