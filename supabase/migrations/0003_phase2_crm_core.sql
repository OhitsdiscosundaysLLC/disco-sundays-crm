-- Phase 2 — CRM core
-- Disco Sundays CRM
-- Adds: customers, leads (+ configurable lead_statuses), tags, customer_tags,
-- notes. Adds the activities -> customers foreign key deferred from Phase 0
-- (docs/DECISIONS.md D-004). All additive; no existing rows to migrate.

create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- 1. customers — the central entity (spec §7)
-- ---------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  display_name text,
  email citext,
  phone text,
  location text,
  company text,
  artist_name text,
  instagram text,
  social_links jsonb not null default '{}'::jsonb,
  customer_type text,
  tags_note text, -- reserved: intentionally unused, see notes table for free text
  source text,
  referral_source text,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  external_square_customer_id text,
  shopify_customer_id text,
  base44_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.customers is 'Source of truth for CRM-owned customer profile data. Square/Shopify remain source of truth for their own transactional data — see docs/DATABASE.md and docs/DECISIONS.md D-011.';

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute procedure public.set_updated_at();

-- Duplicate-prevention indexes (spec §33): external IDs and email are the
-- primary match keys. Case-insensitive via citext. Partial on deleted_at so
-- a soft-deleted customer doesn't block reuse of their email/external id.
create unique index customers_email_key on public.customers (email) where deleted_at is null and email is not null;
create unique index customers_square_id_key on public.customers (external_square_customer_id) where deleted_at is null and external_square_customer_id is not null;
create unique index customers_shopify_id_key on public.customers (shopify_customer_id) where deleted_at is null and shopify_customer_id is not null;
create unique index customers_base44_id_key on public.customers (base44_id) where deleted_at is null and base44_id is not null;
create index customers_phone_idx on public.customers (phone) where deleted_at is null;
create index customers_display_name_trgm_idx on public.customers using gin (display_name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 2. leads — configurable statuses, convertible to a customer (spec §10)
-- ---------------------------------------------------------------------

create table public.lead_statuses (
  slug text primary key,
  label text not null,
  sort_order int not null,
  is_terminal boolean not null default false
);

insert into public.lead_statuses (slug, label, sort_order, is_terminal) values
  ('new', 'New', 1, false),
  ('contacted', 'Contacted', 2, false),
  ('consultation', 'Consultation', 3, false),
  ('proposal', 'Proposal', 4, false),
  ('booked', 'Booked', 5, false),
  ('won', 'Won', 6, true),
  ('lost', 'Lost', 7, true),
  ('nurture', 'Nurture', 8, false);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  email citext,
  phone text,
  status text not null default 'new' references public.lead_statuses (slug),
  source text,
  assigned_staff uuid references public.profiles (id) on delete set null,
  service_interest text,
  notes text,
  converted_customer_id uuid references public.customers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute procedure public.set_updated_at();

create index leads_status_idx on public.leads (status) where deleted_at is null;
create index leads_assigned_staff_idx on public.leads (assigned_staff);
create index leads_converted_customer_id_idx on public.leads (converted_customer_id);

-- ---------------------------------------------------------------------
-- 3. tags / customer_tags
-- ---------------------------------------------------------------------

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.customer_tags (
  customer_id uuid not null references public.customers (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, tag_id)
);

-- ---------------------------------------------------------------------
-- 4. notes — customer-scoped internal notes (spec §7)
-- ---------------------------------------------------------------------

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute procedure public.set_updated_at();

create index notes_customer_id_idx on public.notes (customer_id);

-- ---------------------------------------------------------------------
-- 5. activities — add the foreign key deferred from Phase 0 (D-004)
-- ---------------------------------------------------------------------

alter table public.activities
  add constraint activities_customer_id_fkey
  foreign key (customer_id) references public.customers (id) on delete cascade;

-- ---------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------

alter table public.customers enable row level security;
alter table public.leads enable row level security;
alter table public.lead_statuses enable row level security;
alter table public.tags enable row level security;
alter table public.customer_tags enable row level security;
alter table public.notes enable row level security;

create policy "customers_select" on public.customers
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'customers', 'view'));

create policy "customers_insert" on public.customers
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'customers', 'create'));

create policy "customers_update" on public.customers
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'customers', 'edit'))
  with check (public.has_permission(public.auth_role(), 'customers', 'edit'));

create policy "customers_delete" on public.customers
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'customers', 'delete'));

create policy "leads_select" on public.leads
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'leads', 'view'));

create policy "leads_insert" on public.leads
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'leads', 'create'));

create policy "leads_update" on public.leads
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'leads', 'edit'))
  with check (public.has_permission(public.auth_role(), 'leads', 'edit'));

create policy "leads_delete" on public.leads
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'leads', 'delete'));

create policy "lead_statuses_select" on public.lead_statuses
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'leads', 'view'));

create policy "lead_statuses_write" on public.lead_statuses
  for all to authenticated
  using (public.has_permission(public.auth_role(), 'settings', 'edit'))
  with check (public.has_permission(public.auth_role(), 'settings', 'edit'));

create policy "tags_select" on public.tags
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'customers', 'view'));

create policy "tags_write" on public.tags
  for all to authenticated
  using (public.has_permission(public.auth_role(), 'customers', 'edit'))
  with check (public.has_permission(public.auth_role(), 'customers', 'edit'));

create policy "customer_tags_select" on public.customer_tags
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'customers', 'view'));

create policy "customer_tags_write" on public.customer_tags
  for all to authenticated
  using (public.has_permission(public.auth_role(), 'customers', 'edit'))
  with check (public.has_permission(public.auth_role(), 'customers', 'edit'));

create policy "notes_select" on public.notes
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'customers', 'view'));

create policy "notes_insert" on public.notes
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'customers', 'create') and author_id = (select auth.uid()));

create policy "notes_update" on public.notes
  for update to authenticated
  using (author_id = (select auth.uid()) or public.has_permission(public.auth_role(), 'customers', 'delete'))
  with check (author_id = (select auth.uid()) or public.has_permission(public.auth_role(), 'customers', 'delete'));

create policy "notes_delete" on public.notes
  for delete to authenticated
  using (author_id = (select auth.uid()) or public.has_permission(public.auth_role(), 'customers', 'delete'));
