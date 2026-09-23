-- Phase 0 — Foundation
-- Disco Sundays CRM
-- Creates: user_role enum, profiles, role_permissions (+ seed defaults),
-- audit_logs, activities, helper functions (has_permission, auth_role,
-- handle_new_user, set_updated_at), and RLS policies for all of the above.
--
-- This migration is purely additive against an empty database. See
-- /docs/DATABASE.md and /docs/DECISIONS.md (D-002, D-003, D-004) for
-- rationale.

-- ---------------------------------------------------------------------
-- 1. Roles
-- ---------------------------------------------------------------------

create type public.user_role as enum (
  'owner',
  'admin',
  'manager',
  'staff',
  'photographer',
  'engineer',
  'finance',
  'marketing'
);

-- ---------------------------------------------------------------------
-- 2. profiles — 1:1 with auth.users
-- ---------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  display_name text,
  role public.user_role not null default 'staff',
  status text not null default 'invited' check (status in ('active', 'invited', 'disabled')),
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per staff user, 1:1 with auth.users. Owner role is never self-assigned — see docs/DECISIONS.md D-003.';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- Auto-create a profile row (role=staff, status=invited) whenever a new
-- auth.users row is created. No path here ever grants 'owner'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, status)
  values (new.id, new.email, 'staff', 'invited')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------
-- 3. role_permissions — data-driven permission matrix
-- ---------------------------------------------------------------------

create table public.role_permissions (
  role public.user_role not null,
  resource text not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  primary key (role, resource)
);

comment on table public.role_permissions is 'Data-driven RBAC matrix. Editable via Settings without a code deploy. Read through public.has_permission().';

-- Seed: every role x every nav resource, defaulting to no access.
insert into public.role_permissions (role, resource)
select r.role, res.resource
from unnest(enum_range(null::public.user_role)) as r(role)
cross join (
  values
    ('customers'), ('leads'), ('bookings'), ('services'), ('projects'),
    ('galleries'), ('memberships'), ('referrals'), ('rewards'),
    ('payments'), ('tasks'), ('reports'), ('team'), ('settings')
) as res(resource);

-- Owner & admin: full access everywhere.
update public.role_permissions
set can_view = true, can_create = true, can_edit = true, can_delete = true
where role in ('owner', 'admin');

-- Manager: broad operational access, no destructive delete by default.
update public.role_permissions
set can_view = true, can_create = true, can_edit = true
where role = 'manager'
  and resource in ('customers', 'leads', 'bookings', 'services', 'projects', 'galleries', 'memberships', 'tasks', 'reports');

-- Staff: day-to-day operational resources only.
update public.role_permissions
set can_view = true
where role = 'staff' and resource in ('customers', 'projects');

update public.role_permissions
set can_view = true, can_create = true, can_edit = true
where role = 'staff' and resource in ('bookings', 'tasks');

-- Photographer: projects & galleries for assigned work.
update public.role_permissions
set can_view = true
where role = 'photographer' and resource in ('customers', 'tasks');

update public.role_permissions
set can_view = true, can_create = true, can_edit = true
where role = 'photographer' and resource in ('projects', 'galleries');

-- Engineer: bookings, customers, projects context for sessions.
update public.role_permissions
set can_view = true
where role = 'engineer' and resource = 'customers';

update public.role_permissions
set can_view = true, can_edit = true
where role = 'engineer' and resource in ('bookings', 'projects', 'tasks');

-- Finance: payments and financial reporting.
update public.role_permissions
set can_view = true
where role = 'finance' and resource in ('reports', 'memberships');

update public.role_permissions
set can_view = true, can_create = true, can_edit = true
where role = 'finance' and resource = 'payments';

-- Marketing: customers, leads, referrals, reporting.
update public.role_permissions
set can_view = true
where role = 'marketing' and resource = 'reports';

update public.role_permissions
set can_view = true, can_edit = true
where role = 'marketing' and resource = 'customers';

update public.role_permissions
set can_view = true, can_create = true, can_edit = true
where role = 'marketing' and resource in ('leads', 'referrals');

-- ---------------------------------------------------------------------
-- 4. Helper functions used throughout RLS policies (current and future)
-- ---------------------------------------------------------------------

create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

comment on function public.auth_role() is 'Returns the calling user''s role from profiles. security definer so it can be used inside RLS policies without recursive RLS on profiles.';

create or replace function public.has_permission(p_role public.user_role, p_resource text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_action
    when 'view' then coalesce(bool_or(can_view), false)
    when 'create' then coalesce(bool_or(can_create), false)
    when 'edit' then coalesce(bool_or(can_edit), false)
    when 'delete' then coalesce(bool_or(can_delete), false)
    else false
  end
  from public.role_permissions
  where role = p_role and resource = p_resource;
$$;

comment on function public.has_permission(public.user_role, text, text) is 'Single source of truth for authorization checks, used by RLS policies and (via the app''s server-side Supabase client) by API route handlers.';

-- ---------------------------------------------------------------------
-- 5. audit_logs — sensitive-action audit trail (append-only)
-- ---------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------
-- 6. activities — append-only customer timeline feed
-- customer_id has no FK yet: public.customers does not exist until the
-- Phase 2 migration, which adds the constraint. See docs/DECISIONS.md D-004.
-- ---------------------------------------------------------------------

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid,
  type text not null,
  title text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activities_customer_id_idx on public.activities (customer_id);
create index activities_created_at_idx on public.activities (created_at desc);

-- ---------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.activities enable row level security;

-- profiles: a user always sees their own row; team-permission holders see all.
create policy "profiles_select" on public.profiles
  for select
  using (id = auth.uid() or public.has_permission(public.auth_role(), 'team', 'view'));

create policy "profiles_update" on public.profiles
  for update
  using (id = auth.uid() or public.has_permission(public.auth_role(), 'team', 'edit'))
  with check (id = auth.uid() or public.has_permission(public.auth_role(), 'team', 'edit'));

-- No insert/delete policy for authenticated users: profile rows are created
-- only by the handle_new_user trigger (security definer) and deleted only
-- via auth.users cascade.

-- role_permissions: viewable/editable only by settings-permission holders.
create policy "role_permissions_select" on public.role_permissions
  for select
  using (public.has_permission(public.auth_role(), 'settings', 'view'));

create policy "role_permissions_insert" on public.role_permissions
  for insert
  with check (public.has_permission(public.auth_role(), 'settings', 'edit'));

create policy "role_permissions_update" on public.role_permissions
  for update
  using (public.has_permission(public.auth_role(), 'settings', 'edit'))
  with check (public.has_permission(public.auth_role(), 'settings', 'edit'));

create policy "role_permissions_delete" on public.role_permissions
  for delete
  using (public.has_permission(public.auth_role(), 'settings', 'edit'));

-- audit_logs: read-only for owner/admin; written only by server-side code
-- using the service role (which bypasses RLS entirely).
create policy "audit_logs_select" on public.audit_logs
  for select
  using (public.auth_role() in ('owner', 'admin'));

-- activities: gated on the 'customers' resource until Phase 2 adds a real
-- per-customer FK/policy.
create policy "activities_select" on public.activities
  for select
  using (public.has_permission(public.auth_role(), 'customers', 'view'));
