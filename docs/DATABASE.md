# Database Design

Last updated: 2026-09-23
Engine: Postgres 17 (Supabase project `nrmdcwezgdeiwcebbdcj`)

This document is the schema of record. `/supabase/migrations/*.sql` is the
executable source of truth; this file explains it. Every table below is
tagged with the phase that introduces it. Phase 0 introduces only the
cross-cutting foundation tables — everything else is built when its phase
starts, per RULE 7 (controlled phases).

Conventions used throughout:
- Primary keys: `uuid default gen_random_uuid()`.
- `created_at timestamptz not null default now()`, `updated_at timestamptz`
  maintained by a shared `set_updated_at()` trigger.
- Soft delete via `deleted_at timestamptz` on business records that must be
  recoverable (spec §37) — hard delete only for genuinely disposable rows
  (e.g. individual webhook log entries after retention window).
- Money stored as `numeric(12,2)` with an explicit `currency` column
  (default `'USD'`), never float.
- Every FK to an internal table uses `on delete restrict` by default unless a
  specific cascade makes sense (documented inline in the migration).

## Phase 0 — Foundation (applied now, see `supabase/migrations/0001_foundation.sql`)

### `profiles`
One row per authenticated staff user, 1:1 with `auth.users`.

| column | type | notes |
|---|---|---|
| id | uuid PK | = `auth.users.id` |
| email | text | mirrored from auth for convenience/joins |
| first_name, last_name, display_name | text | |
| role | `user_role` enum | owner/admin/manager/staff/photographer/engineer/finance/marketing |
| status | text | active / invited / disabled |
| phone, avatar_url | text | |
| created_at, updated_at | timestamptz | |

A trigger on `auth.users` (`handle_new_user`) auto-creates a `profiles` row on
signup with `role = 'staff'`, `status = 'invited'`. The first real owner
account is promoted manually via SQL once created (documented in
`DECISIONS.md` D-003) — no self-service path to `owner`.

### `role_permissions`
Database-level permission matrix, editable without a code deploy.

| column | type | notes |
|---|---|---|
| role | `user_role` | |
| resource | text | matches nav sections: customers, leads, bookings, services, projects, galleries, memberships, referrals, rewards, payments, tasks, reports, team, settings |
| can_view, can_create, can_edit, can_delete | boolean | |

PK `(role, resource)`. Seeded with sensible defaults per spec §6 in the
migration. A `has_permission(role, resource, action)` SQL function reads this
table and is used inside RLS policies from Phase 2 onward, so adding a role or
changing what it can touch is a data change, not a migration.

### `audit_logs`
Append-only. Written by server-side operations for sensitive actions (spec
§36): customer deletion/merge, payment changes, reward issuance/adjustment,
membership changes, gallery access changes, permission changes, integration
changes.

| column | type |
|---|---|
| id | uuid PK |
| actor_id | uuid → profiles.id, nullable (null = system) |
| action | text |
| entity_type | text |
| entity_id | uuid |
| metadata | jsonb |
| created_at | timestamptz |

### `activities`
Append-only customer-facing timeline feed (spec §9), separate from
`audit_logs` (which is admin/security-facing). Created now because almost
every future phase writes to it.

| column | type |
|---|---|
| id | uuid PK |
| customer_id | uuid → customers.id — **nullable FK until Phase 2**, see note below |
| type | text | e.g. `booking.created`, `payment.received`, `gallery.published` |
| title | text | human-readable summary |
| metadata | jsonb | |
| created_at | timestamptz |

Note: `customers` does not exist until Phase 2. `activities.customer_id` is
added as a real FK in the Phase 2 migration, not Phase 0 — the Phase 0
migration creates the table without that FK and Phase 2 adds the constraint.
This is called out so nobody is surprised the FK is missing on day one.

## Phase 1 — Foundation (Next.js/auth) additions
No new tables. Auth relies entirely on Supabase Auth + `profiles` +
`role_permissions` above.

## Phase 2 — CRM (applied — `supabase/migrations/0003_phase2_crm_core.sql` + `0004_phase2_hardening.sql`)
- `customers` — id, first_name, last_name, display_name, email (citext),
  phone, location, company, artist_name, instagram, social_links jsonb,
  customer_type, source, referral_source, status, external_square_customer_id,
  shopify_customer_id, base44_id, deleted_at. Lifetime value / booking count /
  referral count are **not** columns here — they're computed from bookings,
  payments, and referrals once those tables exist (Phase 3/7), never
  hand-maintained, so there's exactly one source of truth for each.
- `tags`, `customer_tags` (join table) — reusable tags across customers.
- `notes` — `customer_id`, `author_id`, `body`, timestamps. RLS lets any
  permitted staff read/create, but only the author (or someone with
  `customers.delete`) can edit/delete a given note.
- `leads` — first/last name, email, phone, `status` (FK to a `lead_statuses`
  data table, not an enum — see D-010), source, assigned_staff,
  service_interest, notes, converted_customer_id nullable FK to customers.
- The `activities.customer_id` foreign key deferred in Phase 0 (D-004) is
  added here now that `customers` exists.
- Public registration (`/join`, built in Phase 1/2's application layer) will
  write to `customers`/`leads` through a server action using the service
  role — never directly from the client — and record an `activities` row.
  This table's RLS intentionally grants **no** access to `anon`.
- `supabase/migrations/0005_phase2_activities_write.sql` (applied
  2026-09-23, part of the Claude Code continuation): the Phase 0 migration
  left `activities` with a select policy only ("gated on the 'customers'
  resource until Phase 2 adds a real per-customer FK/policy") but Phase 2
  never added the insert policy, so the application couldn't write a single
  timeline row. Fixed additively — see `docs/DECISIONS.md` D-012.

## Phase 3 — Services / Bookings / Payments (applied — `supabase/migrations/0006_phase3_services_bookings_payments.sql`)
- `services` — name, description, category, price, duration_minutes, active,
  external_square_service_id, shopify_product_id, internal_notes. CRM-owned
  catalog; application UI is full CRUD (list/create/edit/archive).
- `booking_statuses` — configurable lookup table (pending/confirmed/
  completed/cancelled/no_show), same pattern as `lead_statuses` (D-010).
- `bookings` — customer_id, service_id, date, start_time, end_time, staff_id
  (→ profiles), location, status (→ `booking_statuses`), payment_status
  (check constraint: unpaid/partial/paid/refunded), external_square_booking_id,
  notes. Can be created directly in the CRM (no Square ID required) or synced
  from Square once that integration exists — see D-011. Application UI is
  full CRUD; every create/update/cancel writes a customer timeline activity.
- `payments` — customer_id, amount, currency, provider (`square`|`shopify`
  only — the CRM never invents a payment channel, D-011), provider_transaction_id,
  status, paid_at, related booking/order/project via a nullable `related_id` +
  `related_type` discriminator (intentionally not FK-constrained, it's
  polymorphic), metadata jsonb. No card data ever stored — provider
  transaction IDs only. **No insert policy for authenticated users** — a
  payment row can only ever be written by a future webhook handler using the
  service role, same posture as `audit_logs`. Application UI is read-only
  until Square/Shopify sync exists, showing an honest empty state.
- `refunds` — payment_id, amount, reason, provider_refund_id, created_at.
  Same read-only posture as `payments`.

## Phase 4 — Projects + Galleries (applied — `0007_phase4_projects_galleries.sql`; high priority, replaces Effsight)
- `project_statuses` / `projects` / `project_members` — brought forward from
  "Cross-cutting" below since galleries reference `project_id`. Configurable
  status lookup, same pattern as `lead_statuses`/`booking_statuses`.
- `galleries` — title, customer_id, project_id (nullable), description,
  cover_asset_id, slug (unique, public), published boolean, visibility
  (`public`|`private`), password_hash nullable, expires_at nullable,
  allow_downloads boolean.
- `gallery_assets` — gallery_id, storage_path, kind (`image`|`video`),
  position, thumbnail_path, width/height, created_at.
- `gallery_access` was resolved (not built as a separate table) — visibility/
  password/expiry/downloads live directly on `galleries`. See
  `docs/DECISIONS.md` D-015.
- `gallery_views` — lightweight view-log (customer viewed gallery X at time Y)
  feeding the customer timeline.
- Storage buckets `gallery-public` (public) and `gallery-private` (private)
  created via this migration. `galleries`/`gallery_assets`/`gallery_views`
  have no `anon` RLS policies — the public route reads through the service
  role server-side (D-015).

## Phase 5 — Shopify sync
No new core tables; adds `shopify_customer_id`, `shopify_order_id` columns to
`customers`/`payments`, plus `webhook_events` (see Phase 0.5 note below —
actually introduced here since Shopify is the first webhook producer) if not
already created for Square in Phase 3. In practice `webhook_events` is created
in Phase 3 (Square is the first webhook integration) and reused by Shopify.

### `webhook_events` (applied Phase 3 — `0006_phase3_services_bookings_payments.sql`, used by Square + Shopify)
| column | type |
|---|---|
| id | uuid PK |
| provider | text (`square`\|`shopify`\|`base44`) |
| provider_event_id | text — **unique per provider**, this is the idempotency key |
| event_type | text |
| payload | jsonb |
| status | text (`received`\|`processed`\|`failed`) |
| error | text nullable |
| received_at, processed_at | timestamptz |

Unique constraint on `(provider, provider_event_id)` is the idempotency
mechanism required by spec §13/§14/§35.

## Phase 6 — Memberships (applied — `0008_phase6_memberships.sql`)
- `membership_plans` — name, price, billing_interval, benefits jsonb,
  active. Application UI is full CRUD.
- `memberships` — customer_id, plan_id, status (active/paused/cancelled/
  expired), start_date, renewal_date, payment_provider, external_payment_id,
  notes. `payment_provider`/`external_payment_id` are descriptive metadata
  about how the membership is billed, not a `payments` ledger row — see
  D-017. Application UI is full CRUD; status changes and creation write a
  customer timeline activity.
- `membership_usage` — membership_id, booking_id nullable, usage_type,
  amount (hours/sessions), recorded_at — usage is computed from real
  bookings/activity, not hand-entered, per spec §23. No insert policy for
  authenticated users yet (populated by future automation); the
  application instead computes usage live from `bookings.membership_id`.
  See D-017.
- `bookings.membership_id` — nullable FK added in this migration so a
  booking can optionally be attributed to a membership, making the live
  usage query possible.

## Phase 7 — Referrals & Rewards (applied — `0009_phase7_referrals_rewards.sql`, hardened `0010_phase7_harden_reward_trigger.sql`)
- `customers.referral_code` — stable, shareable code per customer (unique
  partial index, generated on demand from the customer profile page).
- `referrals` — referrer_customer_id, referred_customer_id, code, source,
  qualification_status, related_payment_id nullable (FK to `payments`),
  created_at. A `referrals_no_self_referral` check constraint prevents a
  customer referring themselves; a unique index on `referred_customer_id`
  means a customer can only be recorded as referred once. Application UI:
  full create + qualification-status management.
- `reward_accounts` — one per customer, `balance` maintained **only** by a
  trigger (`apply_reward_transaction()`, security definer, direct RPC
  access revoked) off `reward_transactions` inserts — never directly
  writable by any app role. Recomputed from `reward_transactions` (source
  of truth), matching spec §25 exactly.
- `reward_transactions` — customer_id, type, amount, reason,
  related_referral_id/related_booking_id/related_order_id (nullable, one
  populated), created_at, actor_id (staff, self-attributed only — same
  anti-spoofing pattern as D-016 — or `null` for system). Append-only
  ledger — no update/delete policy for any app role. A partial unique
  index on `(related_referral_id) where type = 'referral_reward'` makes
  reward issuance idempotent — a referral can never be paid twice.
  Application UI: "Issue reward" action on a qualified referral (staff
  enters the amount — see D-018 on why no default is invented) plus a
  ledger/balances view at `/rewards`.

## Phase 8 — Base44 migration
- `base44_import_log` — source_record_type, source_id, mapped_table,
  mapped_id, imported_at, raw_payload jsonb — audit trail of the one-time/
  ongoing migration, not a permanent app table.

## Phase 9 — Automation (applied — `0014_phase_automation.sql`)
- `automation_rules` — name, trigger_event (matches `activities.type`),
  action_type (`create_task` only in v1, check-constrained), action_config
  jsonb, active, created_by. `activities` (Phase 0) is the trigger source —
  a `SECURITY DEFINER` trigger (`run_automation_rules()`, RPC execute
  revoked from anon/authenticated, same posture as
  `apply_reward_transaction()`) fires on every `activities` insert and
  creates a task per any active matching rule. See D-026.

## Phase A — Song/Project Pipeline (applied — `0017_phase_a_project_pipeline.sql`)

Turns the Phase 4 `projects` table into a real studio production workflow.
Zero existing project rows at the time of this migration — fully additive,
no backfill risk.

- `project_stages` — 14-value configurable stage list (Inquiry through
  Cancelled/Completed), same pattern as `booking_statuses`. Kept
  **separate** from the existing `status`/`project_statuses` (untouched,
  for backward compatibility) — the spec names both `status` and `stage`
  as distinct project fields.
- `projects` gained: `project_type` (single/EP/album/.../other, check-
  constrained), `artist_name`, `description`, `stage` (FK to
  `project_stages`), `project_manager_id`/`primary_engineer_id` (both FK
  to `profiles` — `engineer` is already a profiles role, no new
  "engineers" table), `estimated_revenue` (a real entered quote figure),
  `priority`. **`actual_revenue`/`balance` are deliberately not stored
  columns** — computed live from `payments` where `related_type='project'`
  and `related_id=projects.id` (that constraint already allowed
  `'project'` since Phase 3), matching this table's pre-existing
  "revenue is derived, never hand-maintained" principle. A full deposit
  lifecycle (required/pending/paid/refunded/forfeited) is deliberately
  deferred to its own table in a later phase rather than bolted on as a
  premature column here.
- `project_songs` — title, track_number (unique per project, partial
  index), status, genre, bpm, song_key, four independent sub-statuses
  (recording/editing/mixing/mastering), final_approval.
- `project_sessions` — project_id/song_id nullable (so it can also back
  general engineer scheduling later without a second table), booking_id
  (links to a real Square-sourced booking where applicable), engineer_id,
  session_type, starts_at/ends_at (duration computed, not stored, to
  avoid drift), status.
- `project_revisions` — a revision *round* tracker (revision_number
  unique per project+song). Coarser than Phase B's planned fine-grained
  timestamped audio feedback.
- `project_deliveries` — records the delivery *event*; reuses the
  existing gallery system (Phase 4) for actual file storage rather than
  duplicating it, via an optional `gallery_id`.
- RLS: every new table gated on the existing `'projects'` permission
  (view/create/edit/delete) — no new `role_permissions` resource, since
  these are all accessed through a project, not standalone.
- Live-verified via direct RLS simulation (owner role): project creation
  with every new field, stage transition, song creation with duplicate
  track_number correctly rejected by the unique index, session creation +
  status update, revision creation with duplicate revision_number
  correctly rejected, delivery recording, and a linked payment correctly
  computing into actual revenue — while confirming `payments` still
  correctly blocks direct authenticated-role writes (service-role only,
  unchanged). Full cleanup verified, zero orphaned rows.

## Phase B — Audio Delivery + Feedback (applied — `0018_phase_b_audio_delivery.sql`)

Builds on Phase A (`project_songs`) and the Phase 4 gallery password/
signed-URL architecture — see D-036 for the full reasoning. No customer
login exists yet (Phase J), so "the authorized customer" is established
the same way a private gallery does: by holding the password to a link
scoped to one project.

- `project_assets` — generic project file record: rough mix, mix
  version, master, instrumental, acapella, stems, WAV, MP3, ZIP,
  artwork, lyrics, document, other. `project_id` + optional `song_id`,
  `storage_path`/`file_name`/`mime_type`/`size_bytes`, `uploaded_by`.
  Private storage only.
- `audio_versions` — wraps one `project_assets` row (`asset_id`, unique)
  with a human `version_label` and the client-review lifecycle status
  (`draft`/`internal_review`/`client_review`/`revision_requested`/
  `approved`/`final`/`delivered`). `duration_seconds` is best-effort,
  read client-side from the browser `<audio>` element's metadata rather
  than parsed server-side — avoids an audio-parsing dependency for a
  value the player already needs anyway. **Old versions are never
  deleted** — the app only ever transitions `status`, matching the
  spec's "do not delete old audio versions" requirement.
- `audio_comments` — timestamped feedback (`timestamp_seconds`,
  `comment`). `author_type` is `staff` or `customer`, with a check
  constraint enforcing exactly one of `author_profile_id`/
  `author_customer_id` is set to match. `status` (open/resolved),
  `resolved_by`/`resolved_at` for staff triage.
- `audio_approvals` — **append-only**, same posture as
  `reward_transactions` (D-008): insert-only, no update or delete policy
  for any role. Unique index on `audio_version_id` (one approval per
  version — a new revision gets a new `audio_versions` row and its own
  approval). `customer_id` uses `ON DELETE RESTRICT`, not
  cascade/set-null, so an approval can never silently lose its audit
  trail.
- `delivery_links` — secure, password-gated customer-facing links: the
  audio-specific counterpart to Phase A's `project_deliveries` (which
  stays the simple gallery-based delivery-event log — flagged as coming
  here in that migration's own comments). `project_id` + optional
  `song_id`, unique `slug`, `password_hash` (reuses
  `lib/gallery-password.ts`), the same lifecycle `status` list as
  `audio_versions`, `expires_at`, `allow_downloads`. `password_hash` is
  never selected by client code and has no anon RLS policy, same as
  `galleries` (D-015).
- `delivery_link_versions` — join table: which `audio_versions` are
  bundled into a given link (a link can carry multiple versions/songs).
- `delivery_link_views` — a view counter, written only by the public
  route via the service role, same pattern as `gallery_views`.
- **Storage**: new private bucket `project-audio` (not a reuse of
  `gallery-private` — separate resource-permission domain, own clean
  `storage.objects` policies gated on `'projects'` instead of
  `'galleries'`). Never public.
- RLS: every table gated on the existing `'projects'` permission, same
  precedent as Phase A — no new `role_permissions` resource.
- Live-verified via direct RLS simulation (owner role): asset/version/
  comment insert; approval insert; **duplicate approval for the same
  version correctly rejected** (unique index); **approval UPDATE and
  DELETE both correctly blocked** under the `authenticated` role (no
  policy exists for either — 0 rows affected, row still intact
  afterward); `audio_comments` author-type/id mismatch correctly
  rejected by the check constraint; delivery link + bundled version
  creation; **cross-link isolation confirmed** — a version bundled only
  into "link A" returns zero matching `delivery_link_versions` rows
  when queried against "link B", proving a visitor holding one link's
  password cannot forge feedback/approval against a version never
  shared with them; cascading delete from the parent project removed
  every Phase B row with zero orphans. `finance`/`marketing` roles
  confirmed denied via `has_permission()` (the same function every
  policy calls). Zero new security-advisor findings. Full cleanup
  verified.

## Cross-cutting
- `tasks` (applied — `0013_phase_tasks.sql`) — `task_statuses` (todo/
  in_progress/done/cancelled, same configurable-status pattern as
  `booking_statuses`), `tasks`: title, description, status, priority
  (low/normal/high/urgent), assignee_id (→ profiles), due_date,
  related_type/related_id (polymorphic — customer/lead/project/booking,
  no FK, same pattern as `payments.related_id`), created_by, completed_at.
  RLS is resource-level only via `has_permission(role, 'tasks', action)` —
  see D-024.
- `projects` — moved up into the Phase 4 section above (built alongside
  galleries, which reference it).
- `integrations` (applied — `0011_integrations_status.sql`) — provider,
  status (connected/not_connected/error), last_checked_at, connected_at,
  metadata jsonb (never raw secrets — those live only in env vars, see
  `SECURITY.md`). Backs the Settings → Integrations "Test connection" and
  "Sync now" actions for Square (live-verified, D-020/D-023) and Shopify
  connection check (D-020/D-021).
- `refunds.provider_refund_id` gained a partial unique index in
  `0012_phase_square_sync_idempotency.sql` — missing from the original
  Phase 3 migration, needed so the Square sync (D-023) can re-run without
  creating duplicate refund rows.
- `services.shopify_product_id` gained a partial unique index in
  `0016_phase_shopify_sync_idempotency.sql` (`services_shopify_id_key`,
  same pattern as `services_square_id_key`) — checked for existing
  duplicate non-null values first (none found) before applying. Needed
  so the Shopify product sync (D-032/D-033) can re-run without creating
  duplicate service rows. `customers.shopify_customer_id` and
  `payments`'s `(provider, provider_transaction_id)` index already
  covered Shopify with no changes needed.

## Customer matching / duplicate prevention (spec §33)

Applied identically by the public registration form, Square sync, Shopify
sync, and Base44 import:

1. Match on external provider ID if present (`external_square_customer_id`,
   `shopify_customer_id`, `base44_id`).
2. Else match on normalized email (case-insensitive, `citext`).
3. Else match on normalized phone (E.164).
4. Otherwise create a new customer. Never auto-merge on fuzzy/low-confidence
   signals (name similarity, etc.) — those surface in an admin merge queue
   instead.

## RLS strategy

Every table holding business data has RLS enabled from the migration that
creates it. Policies are written against `has_permission(role, resource,
action)` reading the caller's role from `profiles` via `auth.uid()`, not
against per-row ad hoc logic, so the permission matrix in `role_permissions`
stays the single place authorization is tuned. Public tables/views used by
`/join`, `/gallery/[slug]`, and `/r/[code]` get narrow, purpose-built policies
(e.g. "select is allowed only where `published = true` and access rules
pass") — never a blanket public-select policy on a full table. Full detail in
`SECURITY.md`.

## Indexing notes

- FK columns are indexed by default in the migrations.
- `customers`: index on `email`, `phone`, trigram index (`pg_trgm`, already
  available as an extension) on `display_name` for search once Phase 2 search
  lands.
- `webhook_events`: unique index on `(provider, provider_event_id)` doubles as
  the idempotency check and the lookup index.
- `galleries.slug`: unique index (public lookup path).
