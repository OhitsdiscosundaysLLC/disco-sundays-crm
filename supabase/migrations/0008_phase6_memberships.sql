-- Phase 6 — Memberships
-- Disco Sundays CRM
-- Adds: membership_plans, memberships, membership_usage, and an optional
-- membership_id link on bookings so usage can be computed from real
-- booking activity rather than hand-entered (docs/DATABASE.md explicit
-- rule for this phase).
--
-- Also fixes an audit_logs gap of the same shape as D-012 (activities):
-- 0001_foundation.sql created audit_logs with only a select policy,
-- intending writes to come from "server-side code using the service
-- role" — but per this session's own standing instruction, the service
-- role must not become a shortcut around normal authorization, so routine
-- sensitive-action logging (membership changes, etc.) needs a real insert
-- policy for authenticated users, same as activities got in 0005. See
-- docs/DECISIONS.md D-016.

-- ---------------------------------------------------------------------
-- 1. membership_plans / memberships / membership_usage
-- ---------------------------------------------------------------------

create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(12,2),
  currency text not null default 'USD',
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly', 'quarterly', 'annual', 'one_time')),
  benefits jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.membership_plans is 'Configurable — plan pricing/benefits are data, not code, per spec RULE 12 (reward/plan amounts are not invented).';

create trigger membership_plans_set_updated_at
  before update on public.membership_plans
  for each row execute procedure public.set_updated_at();

create index membership_plans_active_idx on public.membership_plans (active) where deleted_at is null;

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  plan_id uuid not null references public.membership_plans (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled', 'expired')),
  start_date date not null default current_date,
  renewal_date date,
  payment_provider text check (payment_provider in ('square', 'shopify', 'manual')),
  external_payment_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.memberships is 'payment_provider/external_payment_id are descriptive metadata about how this membership is billed, not a payments ledger row — the payments table (D-011/D-014) remains the only source of truth for actual transactions.';

create trigger memberships_set_updated_at
  before update on public.memberships
  for each row execute procedure public.set_updated_at();

create index memberships_customer_id_idx on public.memberships (customer_id);
create index memberships_plan_id_idx on public.memberships (plan_id);
create index memberships_status_idx on public.memberships (status) where deleted_at is null;

create table public.membership_usage (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  usage_type text not null,
  amount numeric(10,2) not null,
  recorded_at timestamptz not null default now()
);

comment on table public.membership_usage is 'Populated by automation off real booking completions (Phase 9), never hand-entered — see docs/DATABASE.md. No insert policy for authenticated users yet; usage is shown in the application as a live query over bookings.membership_id until that automation exists.';

create index membership_usage_membership_id_idx on public.membership_usage (membership_id);
create index membership_usage_booking_id_idx on public.membership_usage (booking_id);

-- ---------------------------------------------------------------------
-- 2. Optional membership attribution on bookings, so usage/reporting can
-- be computed from real booking activity rather than invented.
-- ---------------------------------------------------------------------

alter table public.bookings
  add column membership_id uuid references public.memberships (id) on delete set null;

create index bookings_membership_id_idx on public.bookings (membership_id);

-- ---------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------

alter table public.membership_plans enable row level security;
alter table public.memberships enable row level security;
alter table public.membership_usage enable row level security;

create policy "membership_plans_select" on public.membership_plans
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'memberships', 'view'));
create policy "membership_plans_insert" on public.membership_plans
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'memberships', 'create'));
create policy "membership_plans_update" on public.membership_plans
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'memberships', 'edit'))
  with check (public.has_permission(public.auth_role(), 'memberships', 'edit'));
create policy "membership_plans_delete" on public.membership_plans
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'memberships', 'delete'));

create policy "memberships_select" on public.memberships
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'memberships', 'view'));
create policy "memberships_insert" on public.memberships
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'memberships', 'create'));
create policy "memberships_update" on public.memberships
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'memberships', 'edit'))
  with check (public.has_permission(public.auth_role(), 'memberships', 'edit'));
create policy "memberships_delete" on public.memberships
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'memberships', 'delete'));

-- membership_usage: read-only for the app today (see table comment) — no
-- insert/update/delete policy for authenticated users yet.
create policy "membership_usage_select" on public.membership_usage
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'memberships', 'view'));

-- ---------------------------------------------------------------------
-- 4. audit_logs insert policy (D-016) — any signed-in staff member can
-- log their own action (actor_id must match their own uid, or be left
-- null for a system-triggered entry); reads remain owner/admin-only.
-- ---------------------------------------------------------------------

create policy "audit_logs_insert" on public.audit_logs
  for insert to authenticated
  with check (actor_id = (select auth.uid()) or actor_id is null);
