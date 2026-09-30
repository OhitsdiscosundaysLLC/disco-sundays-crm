-- Phase C — Real Membership Tracking
-- Disco Sundays CRM
--
-- Inspected first (per the phase's own instructions): membership_plans/
-- memberships/membership_usage already exist (Phase 6) with zero rows in
-- production, bookings.membership_id already exists for attribution
-- (D-017), and a read-only check against Square's live Subscriptions API
-- (GET /v2/subscriptions/search) returned zero subscriptions — this
-- business does not run memberships through Square, so there is no
-- external Square data to sync or reconcile against. Plans/memberships
-- stay genuine CRM-entered data, same as today; no plan or membership
-- rows are invented by this migration.
--
-- The only gap vs. the full spec (included/used/remaining hours, usage
-- percentage) is a structured, staff-entered "how many hours does this
-- plan include" figure — `membership_plans.benefits` is free-form jsonb
-- today and nothing reads an hours figure out of it. Adding one real,
-- honest, nullable column is additive and matches this table's existing
-- comment ("plan pricing/benefits are data, not code").
--
-- Used/remaining hours and usage % are NOT stored — they stay a live
-- computation (lib/membership-usage.ts) over real completed bookings
-- attributed via the existing bookings.membership_id column, scoped to
-- the membership's current billing period (derived from start_date +
-- billing_interval, not a separate invented "periods" table), exactly
-- continuing the precedent already set by D-017 ("usage computed live,
-- never hand-entered").

alter table public.membership_plans
  add column included_hours numeric(6,2)
    check (included_hours is null or included_hours >= 0);

comment on column public.membership_plans.included_hours is 'Real, staff-entered plan entitlement in hours per billing period. Null means unlimited / not hour-based — usage_percentage and remaining_hours are then left null rather than computed against a fabricated ceiling.';
