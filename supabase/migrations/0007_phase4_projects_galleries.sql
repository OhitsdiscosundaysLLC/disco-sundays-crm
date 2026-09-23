-- Phase 4 — Projects (cross-cutting, needed first) + Gallery system
-- Disco Sundays CRM
-- Adds: project_statuses, projects, project_members, galleries,
-- gallery_assets, gallery_views, and the gallery-public/gallery-private
-- Storage buckets. High priority per spec (Effsight replacement).
--
-- Design call deferred from docs/DATABASE.md Phase 4 note ("gallery_access
-- ... kept as a placeholder table name now"): visibility/password_hash/
-- expires_at/allow_downloads are folded directly onto `galleries` rather
-- than a separate gallery_access table — there is exactly one access rule
-- per gallery in this design, so a join table would be pure indirection.
-- See docs/DECISIONS.md D-015.
--
-- The public gallery route (/gallery/[slug], /embed/gallery/[id]) reads
-- through the service role from trusted server-side code, never through
-- anon-key RLS — password verification isn't expressible as a safe RLS
-- predicate, and password_hash must never be readable via the client
-- PostgREST API even indirectly. See docs/DECISIONS.md D-015 and
-- docs/SECURITY.md §3. Accordingly galleries/gallery_assets/gallery_views
-- have no `anon` policies at all here.

-- ---------------------------------------------------------------------
-- 1. project_statuses / projects / project_members
-- ---------------------------------------------------------------------

create table public.project_statuses (
  slug text primary key,
  label text not null,
  sort_order int not null,
  is_terminal boolean not null default false
);

insert into public.project_statuses (slug, label, sort_order, is_terminal) values
  ('planning', 'Planning', 1, false),
  ('in_progress', 'In progress', 2, false),
  ('review', 'Review', 3, false),
  ('delivered', 'Delivered', 4, true),
  ('cancelled', 'Cancelled', 5, true);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  service_id uuid references public.services (id) on delete set null,
  name text not null,
  status text not null default 'planning' references public.project_statuses (slug),
  start_date date,
  due_date date,
  completion_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.projects is 'revenue is deliberately not a column — it is derived from linked payments once Square/Shopify sync exists, never hand-maintained (docs/DATABASE.md).';

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute procedure public.set_updated_at();

create index projects_customer_id_idx on public.projects (customer_id);
create index projects_service_id_idx on public.projects (service_id);
create index projects_status_idx on public.projects (status) where deleted_at is null;

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  staff_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, staff_id)
);

create index project_members_staff_id_idx on public.project_members (staff_id);

-- ---------------------------------------------------------------------
-- 2. galleries / gallery_assets / gallery_views
-- ---------------------------------------------------------------------

create table public.galleries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  project_id uuid references public.projects (id) on delete set null,
  title text not null,
  description text,
  cover_asset_id uuid,
  slug text not null,
  published boolean not null default false,
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  password_hash text,
  expires_at timestamptz,
  allow_downloads boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.galleries is 'password_hash is never selected by client code and has no anon RLS policy — the public route reads through the service role server-side. See docs/DECISIONS.md D-015.';

create trigger galleries_set_updated_at
  before update on public.galleries
  for each row execute procedure public.set_updated_at();

create unique index galleries_slug_key on public.galleries (slug) where deleted_at is null;
create index galleries_customer_id_idx on public.galleries (customer_id);
create index galleries_project_id_idx on public.galleries (project_id);

create table public.gallery_assets (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries (id) on delete cascade,
  storage_path text not null,
  kind text not null check (kind in ('image', 'video')),
  position int not null default 0,
  thumbnail_path text,
  width int,
  height int,
  created_at timestamptz not null default now()
);

create index gallery_assets_gallery_id_idx on public.gallery_assets (gallery_id);

alter table public.galleries
  add constraint galleries_cover_asset_id_fkey
  foreign key (cover_asset_id) references public.gallery_assets (id) on delete set null;

create table public.gallery_views (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  viewed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index gallery_views_gallery_id_idx on public.gallery_views (gallery_id);

-- ---------------------------------------------------------------------
-- 3. Storage buckets
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('gallery-public', 'gallery-public', true),
  ('gallery-private', 'gallery-private', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------

alter table public.project_statuses enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.galleries enable row level security;
alter table public.gallery_assets enable row level security;
alter table public.gallery_views enable row level security;

create policy "project_statuses_select" on public.project_statuses
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'view'));
create policy "project_statuses_insert" on public.project_statuses
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'settings', 'edit'));
create policy "project_statuses_update" on public.project_statuses
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'settings', 'edit'))
  with check (public.has_permission(public.auth_role(), 'settings', 'edit'));
create policy "project_statuses_delete" on public.project_statuses
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'settings', 'edit'));

create policy "projects_select" on public.projects
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'view'));
create policy "projects_insert" on public.projects
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'projects', 'create'));
create policy "projects_update" on public.projects
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'edit'))
  with check (public.has_permission(public.auth_role(), 'projects', 'edit'));
create policy "projects_delete" on public.projects
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'delete'));

create policy "project_members_select" on public.project_members
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'view'));
create policy "project_members_insert" on public.project_members
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'projects', 'edit'));
create policy "project_members_delete" on public.project_members
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'edit'));

create policy "galleries_select" on public.galleries
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'galleries', 'view'));
create policy "galleries_insert" on public.galleries
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'galleries', 'create'));
create policy "galleries_update" on public.galleries
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'galleries', 'edit'))
  with check (public.has_permission(public.auth_role(), 'galleries', 'edit'));
create policy "galleries_delete" on public.galleries
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'galleries', 'delete'));

create policy "gallery_assets_select" on public.gallery_assets
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'galleries', 'view'));
create policy "gallery_assets_insert" on public.gallery_assets
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'galleries', 'edit'));
create policy "gallery_assets_update" on public.gallery_assets
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'galleries', 'edit'))
  with check (public.has_permission(public.auth_role(), 'galleries', 'edit'));
create policy "gallery_assets_delete" on public.gallery_assets
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'galleries', 'delete'));

-- gallery_views: system/public writes happen via the service role (bypasses
-- RLS); staff can read view logs for galleries they can view.
create policy "gallery_views_select" on public.gallery_views
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'galleries', 'view'));

-- ---------------------------------------------------------------------
-- 5. Storage object policies
-- Staff manage uploads through the authenticated role; public downloads
-- from gallery-public happen via Supabase's public-bucket URL (bypasses
-- RLS by design for public buckets) — no anon policy needed. gallery-private
-- downloads happen only via server-generated signed URLs (service role),
-- also bypassing RLS — no anon policy needed there either.
-- ---------------------------------------------------------------------

create policy "gallery_public_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'gallery-public' and public.has_permission(public.auth_role(), 'galleries', 'view'));
create policy "gallery_public_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'gallery-public' and public.has_permission(public.auth_role(), 'galleries', 'create'));
create policy "gallery_public_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'gallery-public' and public.has_permission(public.auth_role(), 'galleries', 'edit'))
  with check (bucket_id = 'gallery-public' and public.has_permission(public.auth_role(), 'galleries', 'edit'));
create policy "gallery_public_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'gallery-public' and public.has_permission(public.auth_role(), 'galleries', 'delete'));

create policy "gallery_private_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'gallery-private' and public.has_permission(public.auth_role(), 'galleries', 'view'));
create policy "gallery_private_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'gallery-private' and public.has_permission(public.auth_role(), 'galleries', 'create'));
create policy "gallery_private_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'gallery-private' and public.has_permission(public.auth_role(), 'galleries', 'edit'))
  with check (bucket_id = 'gallery-private' and public.has_permission(public.auth_role(), 'galleries', 'edit'));
create policy "gallery_private_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'gallery-private' and public.has_permission(public.auth_role(), 'galleries', 'delete'));
