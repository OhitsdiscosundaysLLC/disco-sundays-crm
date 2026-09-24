-- Integrations status tracking
-- Disco Sundays CRM
-- Adds the `integrations` table from docs/DATABASE.md's cross-cutting
-- section, backing the "Integrations settings page" (spec §34,
-- docs/INTEGRATIONS.md). Stores connection status/metadata only — never
-- raw secrets, which live only in env vars per docs/SECURITY.md.

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique check (provider in ('square', 'shopify', 'base44')),
  status text not null default 'not_connected' check (status in ('connected', 'not_connected', 'error')),
  last_checked_at timestamptz,
  connected_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.integrations is 'Connection status only — never raw secrets (docs/SECURITY.md). metadata holds non-sensitive diagnostic info (e.g. location count, last error code), never tokens.';

create trigger integrations_set_updated_at
  before update on public.integrations
  for each row execute procedure public.set_updated_at();

insert into public.integrations (provider, status) values
  ('square', 'not_connected'),
  ('shopify', 'not_connected'),
  ('base44', 'not_connected');

alter table public.integrations enable row level security;

create policy "integrations_select" on public.integrations
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'settings', 'view'));
create policy "integrations_update" on public.integrations
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'settings', 'edit'))
  with check (public.has_permission(public.auth_role(), 'settings', 'edit'));
