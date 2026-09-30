-- Phase B — Audio Delivery + Feedback
-- Disco Sundays CRM
--
-- Builds on Phase A (project_songs) and the Phase 4 gallery
-- password/signed-URL architecture. Reuses that exact pattern for
-- customer-facing access rather than inventing a new auth system: this
-- CRM has no customer login yet (Phase J adds a real client portal),
-- so "the authorized customer" is established the same way a gallery
-- establishes it today — by holding the password to a link that is
-- itself scoped to one project (and therefore one customer).
--
-- Design notes:
-- - A dedicated `project-audio` private Storage bucket, not a reuse of
--   `gallery-private` — different resource permission domain ('projects'
--   vs 'galleries'), so it gets its own clean RLS policies instead of
--   OR-ing extra conditions into a bucket that's already working for
--   gallery photos/video. Same separation-of-concerns already used for
--   gallery-public vs gallery-private.
-- - `delivery_links` is the audio-specific counterpart to Phase A's
--   `project_deliveries` (which stays the simple "delivery event log"
--   pointed at a gallery) — Phase A's own migration comment already
--   flagged this table as coming in Phase B.
-- - `audio_approvals` is append-only: insert only, no update/delete
--   policy for any role, same posture as `reward_transactions` (D-008).
-- - `audio_comments.author_*` split by author_type — a comment is either
--   staff (profiles) or customer, enforced by a check constraint, never
--   both/neither.
-- - No new role_permissions resource: every new table is a sub-resource
--   of a project, gated on the existing 'projects' permission, same
--   precedent as Phase A.
-- - Duration is read client-side from the browser's <audio> element on
--   playback/upload, not parsed server-side — avoids adding an audio-
--   parsing dependency for a value the player already needs from
--   metadata anyway. duration_seconds is nullable and best-effort.

-- ---------------------------------------------------------------------
-- 1. project_assets — generic project file record (audio + supporting
--    creative assets). Private storage only; unreleased music must never
--    be reachable without a signed URL.
-- ---------------------------------------------------------------------

create table public.project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  song_id uuid references public.project_songs (id) on delete set null,
  asset_type text not null check (asset_type in (
    'rough_mix', 'mix_version', 'master', 'instrumental', 'acapella', 'stems',
    'wav', 'mp3', 'zip', 'artwork', 'lyrics', 'document', 'other'
  )),
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index project_assets_project_id_idx on public.project_assets (project_id) where deleted_at is null;
create index project_assets_song_id_idx on public.project_assets (song_id);

-- ---------------------------------------------------------------------
-- 2. audio_versions — a playable version wrapping one project_asset,
--    with the client-review lifecycle status.
-- ---------------------------------------------------------------------

create table public.audio_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  song_id uuid references public.project_songs (id) on delete set null,
  asset_id uuid not null unique references public.project_assets (id) on delete cascade,
  version_label text not null,
  status text not null default 'draft' check (status in (
    'draft', 'internal_review', 'client_review', 'revision_requested', 'approved', 'final', 'delivered'
  )),
  duration_seconds numeric,
  notes text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on column public.audio_versions.duration_seconds is 'Best-effort, read from the browser <audio> element''s metadata — not parsed server-side, so may be null until first played/uploaded with a duration-aware client.';

create trigger audio_versions_set_updated_at
  before update on public.audio_versions
  for each row execute procedure public.set_updated_at();

create index audio_versions_project_id_idx on public.audio_versions (project_id) where deleted_at is null;
create index audio_versions_song_id_idx on public.audio_versions (song_id);
create index audio_versions_status_idx on public.audio_versions (status);

-- ---------------------------------------------------------------------
-- 3. audio_comments — timestamped feedback, staff or customer authored.
-- ---------------------------------------------------------------------

create table public.audio_comments (
  id uuid primary key default gen_random_uuid(),
  audio_version_id uuid not null references public.audio_versions (id) on delete cascade,
  timestamp_seconds numeric not null check (timestamp_seconds >= 0),
  comment text not null,
  author_type text not null check (author_type in ('staff', 'customer')),
  author_profile_id uuid references public.profiles (id) on delete set null,
  author_customer_id uuid references public.customers (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint audio_comments_author_matches_type check (
    (author_type = 'staff' and author_profile_id is not null and author_customer_id is null)
    or (author_type = 'customer' and author_customer_id is not null and author_profile_id is null)
  )
);

create index audio_comments_audio_version_id_idx on public.audio_comments (audio_version_id);
create index audio_comments_status_idx on public.audio_comments (status);

-- ---------------------------------------------------------------------
-- 4. audio_approvals — append-only, one approval per version. Old
--    versions and their approvals are never deleted; a new revision
--    gets a new audio_version row and its own approval.
-- ---------------------------------------------------------------------

create table public.audio_approvals (
  id uuid primary key default gen_random_uuid(),
  audio_version_id uuid not null references public.audio_versions (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.audio_approvals is 'Append-only audit ledger (same posture as reward_transactions, D-008) — no update/delete policy for any role. customer_id uses ON DELETE RESTRICT, not CASCADE/SET NULL, so an approval can never silently lose its audit trail.';

create unique index audio_approvals_version_key on public.audio_approvals (audio_version_id);
create index audio_approvals_customer_id_idx on public.audio_approvals (customer_id);

-- ---------------------------------------------------------------------
-- 5. delivery_links — secure, password-gated customer-facing links.
--    Audio-specific counterpart to project_deliveries (Phase A), which
--    remains the simple gallery-based delivery event log.
-- ---------------------------------------------------------------------

create table public.delivery_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  song_id uuid references public.project_songs (id) on delete set null,
  slug text not null unique,
  password_hash text,
  status text not null default 'draft' check (status in (
    'draft', 'internal_review', 'client_review', 'revision_requested', 'approved', 'final', 'delivered'
  )),
  expires_at timestamptz,
  allow_downloads boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.delivery_links is 'password_hash is never selected by client code and has no anon RLS policy — the public /deliver/[slug] route reads through the service role server-side, same pattern as galleries (D-015).';

create trigger delivery_links_set_updated_at
  before update on public.delivery_links
  for each row execute procedure public.set_updated_at();

create index delivery_links_project_id_idx on public.delivery_links (project_id) where deleted_at is null;
create index delivery_links_song_id_idx on public.delivery_links (song_id);

create table public.delivery_link_versions (
  delivery_link_id uuid not null references public.delivery_links (id) on delete cascade,
  audio_version_id uuid not null references public.audio_versions (id) on delete cascade,
  primary key (delivery_link_id, audio_version_id)
);

create index delivery_link_versions_audio_version_id_idx on public.delivery_link_versions (audio_version_id);

create table public.delivery_link_views (
  id uuid primary key default gen_random_uuid(),
  delivery_link_id uuid not null references public.delivery_links (id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index delivery_link_views_delivery_link_id_idx on public.delivery_link_views (delivery_link_id);

-- ---------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------

alter table public.project_assets enable row level security;
alter table public.audio_versions enable row level security;
alter table public.audio_comments enable row level security;
alter table public.audio_approvals enable row level security;
alter table public.delivery_links enable row level security;
alter table public.delivery_link_versions enable row level security;
alter table public.delivery_link_views enable row level security;

create policy "project_assets_select" on public.project_assets
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'view'));
create policy "project_assets_insert" on public.project_assets
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'projects', 'create'));
create policy "project_assets_update" on public.project_assets
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'edit'))
  with check (public.has_permission(public.auth_role(), 'projects', 'edit'));
create policy "project_assets_delete" on public.project_assets
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'delete'));

create policy "audio_versions_select" on public.audio_versions
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'view'));
create policy "audio_versions_insert" on public.audio_versions
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'projects', 'create'));
create policy "audio_versions_update" on public.audio_versions
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'edit'))
  with check (public.has_permission(public.auth_role(), 'projects', 'edit'));
create policy "audio_versions_delete" on public.audio_versions
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'delete'));

-- audio_comments: staff can read/create/update(resolve)/delete under the
-- 'projects' permission. Customer-authored comments are written by the
-- public /deliver/[slug] server action via the service role (bypasses
-- RLS entirely, same as gallery_views inserts) after re-verifying the
-- link's password cookie — there is no anon policy on this table.
create policy "audio_comments_select" on public.audio_comments
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'view'));
create policy "audio_comments_insert" on public.audio_comments
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'projects', 'edit'));
create policy "audio_comments_update" on public.audio_comments
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'edit'))
  with check (public.has_permission(public.auth_role(), 'projects', 'edit'));
create policy "audio_comments_delete" on public.audio_comments
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'delete'));

-- audio_approvals: staff can read. Customer approvals are written by the
-- public delivery route via the service role, same reasoning as above.
-- Staff may also log an approval obtained out-of-band (e.g. a verbal/
-- email approval) with 'projects' edit permission. No update or delete
-- policy exists for any role — approvals are permanent once recorded.
create policy "audio_approvals_select" on public.audio_approvals
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'view'));
create policy "audio_approvals_insert" on public.audio_approvals
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'projects', 'edit'));

create policy "delivery_links_select" on public.delivery_links
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'view'));
create policy "delivery_links_insert" on public.delivery_links
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'projects', 'create'));
create policy "delivery_links_update" on public.delivery_links
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'edit'))
  with check (public.has_permission(public.auth_role(), 'projects', 'edit'));
create policy "delivery_links_delete" on public.delivery_links
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'delete'));

create policy "delivery_link_versions_select" on public.delivery_link_versions
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'view'));
create policy "delivery_link_versions_insert" on public.delivery_link_versions
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'projects', 'edit'));
create policy "delivery_link_versions_delete" on public.delivery_link_versions
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'edit'));

-- delivery_link_views: staff read-only (view counter). Rows are inserted
-- exclusively by the public route via the service role, same as
-- gallery_views.
create policy "delivery_link_views_select" on public.delivery_link_views
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'view'));

-- ---------------------------------------------------------------------
-- 7. Storage — dedicated private bucket for project audio/creative
--    assets. Never public: unreleased music must not become reachable
--    merely to make playback work (spec requirement). Same policy shape
--    as gallery-private (0007_phase4_projects_galleries.sql), gated on
--    the 'projects' permission instead of 'galleries'.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('project-audio', 'project-audio', false)
on conflict (id) do nothing;

create policy "project_audio_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'project-audio' and public.has_permission(public.auth_role(), 'projects', 'view'));
create policy "project_audio_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-audio' and public.has_permission(public.auth_role(), 'projects', 'create'));
create policy "project_audio_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'project-audio' and public.has_permission(public.auth_role(), 'projects', 'edit'))
  with check (bucket_id = 'project-audio' and public.has_permission(public.auth_role(), 'projects', 'edit'));
create policy "project_audio_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-audio' and public.has_permission(public.auth_role(), 'projects', 'delete'));
