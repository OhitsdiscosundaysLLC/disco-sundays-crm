-- Phase D — Engineer Management
-- Disco Sundays CRM
--
-- Uses the existing `engineer` profiles role directly (0001_foundation.sql)
-- and the existing `project_sessions.engineer_id` / `bookings.staff_id` /
-- `projects.primary_engineer_id` columns (Phase A / Phase 3) for
-- assignments, sessions, and projects — no new "engineers" table, per the
-- phase's own instruction ("do not create an unnecessary Engineer table
-- if Team/User profiles can support this safely").
--
-- Two additive columns on `profiles`:
-- - `specialties text[]` — real, staff-entered tags (e.g. "mixing",
--   "mastering", "vocal production"). Nullable; an empty roster isn't
--   fabricated with placeholder tags.
-- - `commission_rate numeric(5,2)` — a real, staff-entered percentage.
--   Nullable, meaning "not set" — payout/commission figures stay null
--   ("not configured") rather than assuming a default rate the business
--   never defined, per the project's standing "never invent business
--   amounts" rule (RULE 12, same reasoning as D-018's referral rewards).
--
-- Active/inactive is NOT a new column — `profiles.status` already has
-- exactly this domain (`active`/`invited`/`disabled`).
--
-- Scheduled/completed/billable hours, revenue attributed, and commission
-- owed are NOT stored — computed live (lib/engineer-metrics.ts) from real
-- project_sessions/bookings/payments, same "derive, don't store"
-- principle as Phase A's actual_revenue and Phase C's usage hours.

alter table public.profiles
  add column specialties text[],
  add column commission_rate numeric(5,2)
    check (commission_rate is null or (commission_rate >= 0 and commission_rate <= 100));

comment on column public.profiles.commission_rate is 'Real, staff-entered percentage. Null means not configured — commission/payout figures are then left null rather than computed against a fabricated default rate.';
