-- Phase 3 — Services / Bookings / Payments
-- Disco Sundays CRM
-- Adds: services (CRM-owned catalog), booking_statuses (configurable, same
-- pattern as lead_statuses/D-010), bookings, payments, refunds,
-- webhook_events (idempotency table for Square + later Shopify — D-005).
-- All additive. No Square/Shopify credentials exist yet (docs/INTEGRATIONS.md)
-- so this is schema + application UI only; sync code lands when credentials
-- do, per docs/CLAUDE_CODE_HANDOFF.md section AH.

-- ---------------------------------------------------------------------
-- 1. services — the service catalog is data, not code (spec §1)
-- ---------------------------------------------------------------------

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text,
  price numeric(12,2),
  currency text not null default 'USD',
  duration_minutes int,
  active boolean not null default true,
  external_square_service_id text,
  shopify_product_id text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.services is 'CRM-owned service catalog. Square/Shopify product IDs are optional cross-references, not the source of the catalog itself.';

create trigger services_set_updated_at
  before update on public.services
  for each row execute procedure public.set_updated_at();

create unique index services_square_id_key on public.services (external_square_service_id) where deleted_at is null and external_square_service_id is not null;
create index services_active_idx on public.services (active) where deleted_at is null;

-- ---------------------------------------------------------------------
-- 2. booking_statuses / bookings
-- ---------------------------------------------------------------------

create table public.booking_statuses (
  slug text primary key,
  label text not null,
  sort_order int not null,
  is_terminal boolean not null default false
);

insert into public.booking_statuses (slug, label, sort_order, is_terminal) values
  ('pending', 'Pending', 1, false),
  ('confirmed', 'Confirmed', 2, false),
  ('completed', 'Completed', 3, true),
  ('cancelled', 'Cancelled', 4, true),
  ('no_show', 'No-show', 5, true);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  date date not null,
  start_time time,
  end_time time,
  staff_id uuid references public.profiles (id) on delete set null,
  location text,
  status text not null default 'pending' references public.booking_statuses (slug),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid', 'refunded')),
  external_square_booking_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.bookings is 'Square remains source of truth for Square-managed bookings (external_square_booking_id set); bookings created directly in the CRM have no Square ID. See docs/DECISIONS.md D-011.';

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute procedure public.set_updated_at();

create unique index bookings_square_id_key on public.bookings (external_square_booking_id) where deleted_at is null and external_square_booking_id is not null;
create index bookings_customer_id_idx on public.bookings (customer_id);
create index bookings_service_id_idx on public.bookings (service_id);
create index bookings_staff_id_idx on public.bookings (staff_id);
create index bookings_date_idx on public.bookings (date) where deleted_at is null;
create index bookings_status_idx on public.bookings (status) where deleted_at is null;

-- ---------------------------------------------------------------------
-- 3. payments / refunds
-- provider is constrained to square|shopify (docs/DATABASE.md) — the CRM
-- never invents a third payment channel; a payment row only exists once
-- Square or Shopify confirms it (docs/DECISIONS.md D-011). Until their
-- sync is built (Phase 3 Square / Phase 5 Shopify credentials), this table
-- has no write path and the application UI is read-only, showing an
-- honest empty state rather than allowing fabricated payment records
-- (spec RULE 2).
-- ---------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  provider text not null check (provider in ('square', 'shopify')),
  provider_transaction_id text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded', 'partially_refunded')),
  paid_at timestamptz,
  related_type text check (related_type in ('booking', 'order', 'project')),
  related_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.payments is 'No raw card data — provider transaction IDs only (docs/SECURITY.md §1). related_id is polymorphic (booking/order/project) so it intentionally has no FK constraint.';

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute procedure public.set_updated_at();

create unique index payments_provider_transaction_key on public.payments (provider, provider_transaction_id);
create index payments_customer_id_idx on public.payments (customer_id);
create index payments_related_idx on public.payments (related_type, related_id);
create index payments_status_idx on public.payments (status);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  amount numeric(12,2) not null,
  reason text,
  provider_refund_id text,
  created_at timestamptz not null default now()
);

create index refunds_payment_id_idx on public.refunds (payment_id);

-- ---------------------------------------------------------------------
-- 4. webhook_events — shared idempotency table for Square (Phase 3) and
-- Shopify (Phase 5), per docs/DECISIONS.md D-005. Written only by
-- server-side webhook route handlers using the service role, never by an
-- authenticated user's own session — same posture as audit_logs.
-- ---------------------------------------------------------------------

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('square', 'shopify', 'base44')),
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'failed')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create unique index webhook_events_provider_event_key on public.webhook_events (provider, provider_event_id);
create index webhook_events_status_idx on public.webhook_events (status);

-- ---------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------

alter table public.services enable row level security;
alter table public.booking_statuses enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.webhook_events enable row level security;

create policy "services_select" on public.services
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'services', 'view'));
create policy "services_insert" on public.services
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'services', 'create'));
create policy "services_update" on public.services
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'services', 'edit'))
  with check (public.has_permission(public.auth_role(), 'services', 'edit'));
create policy "services_delete" on public.services
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'services', 'delete'));

create policy "booking_statuses_select" on public.booking_statuses
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'bookings', 'view'));
create policy "booking_statuses_insert" on public.booking_statuses
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'settings', 'edit'));
create policy "booking_statuses_update" on public.booking_statuses
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'settings', 'edit'))
  with check (public.has_permission(public.auth_role(), 'settings', 'edit'));
create policy "booking_statuses_delete" on public.booking_statuses
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'settings', 'edit'));

create policy "bookings_select" on public.bookings
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'bookings', 'view'));
create policy "bookings_insert" on public.bookings
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'bookings', 'create'));
create policy "bookings_update" on public.bookings
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'bookings', 'edit'))
  with check (public.has_permission(public.auth_role(), 'bookings', 'edit'));
create policy "bookings_delete" on public.bookings
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'bookings', 'delete'));

-- payments/refunds: view-only for the app today (see table comment) — no
-- insert/update/delete policy for authenticated users. Rows will only ever
-- be written by a future webhook route handler using the service role,
-- which bypasses RLS entirely, same posture as audit_logs.
create policy "payments_select" on public.payments
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'payments', 'view'));

create policy "refunds_select" on public.refunds
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'payments', 'view'));

-- webhook_events: internal event log, visible to admins in Settings
-- (docs/SECURITY.md §4). No write policy for authenticated users — same
-- posture as audit_logs/payments above.
create policy "webhook_events_select" on public.webhook_events
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'settings', 'view'));

-- ---------------------------------------------------------------------
-- 6. activities write policy: extend to the new resources so booking/
-- payment timeline entries can be written the same way customer ones are
-- (see 0005_phase2_activities_write.sql).
-- ---------------------------------------------------------------------

drop policy "activities_insert" on public.activities;
create policy "activities_insert" on public.activities
  for insert to authenticated
  with check (
    public.has_permission(public.auth_role(), 'customers', 'create')
    or public.has_permission(public.auth_role(), 'customers', 'edit')
    or public.has_permission(public.auth_role(), 'bookings', 'create')
    or public.has_permission(public.auth_role(), 'bookings', 'edit')
  );
