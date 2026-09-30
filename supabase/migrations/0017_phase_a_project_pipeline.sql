-- Phase A — Song / Project Pipeline
-- Disco Sundays CRM
-- Turns the existing lightweight `projects` module into a real studio
-- production workflow. All additive — zero existing project rows at the
-- time this was written (verified before writing this migration), so no
-- backfill/data-migration risk.
--
-- Design notes:
-- - `engineer` is already a profiles role (0001_foundation.sql) — no new
--   "engineers" table. project_manager_id/primary_engineer_id/
--   project_sessions.engineer_id all reference profiles directly,
--   reusing the existing role system rather than inventing a parallel one.
-- - `status` (existing, project_statuses-backed) is left untouched for
--   backward compatibility; `stage` is a new, separate, finer-grained
--   production-pipeline field — the user's own field list names both
--   "status" and "stage" as distinct project attributes.
-- - actual_revenue/balance are deliberately NOT stored columns — same
--   principle already documented on this table ("revenue is deliberately
--   not a column — it is derived from linked payments"). Sessions/songs/
--   revisions/deliveries all link to a project; actual revenue is
--   computed from `payments` rows where related_type='project' and
--   related_id=projects.id (that check constraint already allowed
--   'project' since Phase 3). Formal deposit lifecycle tracking
--   (required/pending/paid/partially paid/refunded/forfeited) is
--   deliberately deferred to its own proper table in a later phase
--   rather than bolted on here as a single premature column.
-- - No new role_permissions resource — all new tables are sub-resources
--   of a project and gated on the existing 'projects' permission
--   (view/create/edit/delete), avoiding permission-matrix bloat for
--   things that are always accessed through a project.

-- ---------------------------------------------------------------------
-- 1. project_stages — configurable, same pattern as booking_statuses/
--    project_statuses/task_statuses.
-- ---------------------------------------------------------------------

create table public.project_stages (
  slug text primary key,
  label text not null,
  sort_order int not null,
  is_terminal boolean not null default false
);

insert into public.project_stages (slug, label, sort_order, is_terminal) values
  ('inquiry', 'Inquiry', 1, false),
  ('consultation', 'Consultation', 2, false),
  ('booked', 'Booked', 3, false),
  ('pre_production', 'Pre-production', 4, false),
  ('recording', 'Recording', 5, false),
  ('editing', 'Editing', 6, false),
  ('mixing', 'Mixing', 7, false),
  ('client_review', 'Client Review', 8, false),
  ('revision', 'Revision', 9, false),
  ('mastering', 'Mastering', 10, false),
  ('final_approval', 'Final Approval', 11, false),
  ('delivered', 'Delivered', 12, true),
  ('completed', 'Completed', 13, true),
  ('cancelled', 'Cancelled', 14, true);

alter table public.project_stages enable row level security;

create policy "project_stages_select" on public.project_stages
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'view'));
create policy "project_stages_insert" on public.project_stages
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'settings', 'edit'));
create policy "project_stages_update" on public.project_stages
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'settings', 'edit'))
  with check (public.has_permission(public.auth_role(), 'settings', 'edit'));
create policy "project_stages_delete" on public.project_stages
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'settings', 'edit'));

-- ---------------------------------------------------------------------
-- 2. projects — additive columns only.
-- ---------------------------------------------------------------------

alter table public.projects
  add column project_type text not null default 'single'
    check (project_type in ('single', 'ep', 'album', 'mixtape', 'recording', 'production', 'mixing', 'mastering', 'other')),
  add column artist_name text,
  add column description text,
  add column stage text not null default 'inquiry' references public.project_stages (slug),
  add column project_manager_id uuid references public.profiles (id) on delete set null,
  add column primary_engineer_id uuid references public.profiles (id) on delete set null,
  add column estimated_revenue numeric(12,2),
  add column priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent'));

comment on column public.projects.estimated_revenue is 'A quote/forecast figure, genuinely entered by staff — not derived. Actual revenue and outstanding balance are computed live from payments where related_type=''project'' and related_id=projects.id, never stored, matching this table''s existing revenue principle.';

create index projects_stage_idx on public.projects (stage) where deleted_at is null;
create index projects_project_manager_id_idx on public.projects (project_manager_id);
create index projects_primary_engineer_id_idx on public.projects (primary_engineer_id);

-- ---------------------------------------------------------------------
-- 3. project_songs
-- ---------------------------------------------------------------------

create table public.project_songs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  track_number int,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  genre text,
  bpm int,
  song_key text,
  recording_status text not null default 'not_started' check (recording_status in ('not_started', 'in_progress', 'complete')),
  editing_status text not null default 'not_started' check (editing_status in ('not_started', 'in_progress', 'complete')),
  mixing_status text not null default 'not_started' check (mixing_status in ('not_started', 'in_progress', 'complete')),
  mastering_status text not null default 'not_started' check (mastering_status in ('not_started', 'in_progress', 'complete')),
  final_approval boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on column public.project_songs.song_key is 'Musical key (e.g. "C#m") — named song_key, not key, to avoid colliding with the SQL keyword.';

create trigger project_songs_set_updated_at
  before update on public.project_songs
  for each row execute procedure public.set_updated_at();

create index project_songs_project_id_idx on public.project_songs (project_id) where deleted_at is null;
create unique index project_songs_project_track_key on public.project_songs (project_id, track_number) where deleted_at is null and track_number is not null;

-- ---------------------------------------------------------------------
-- 4. project_sessions — project_id/song_id nullable so this can also
-- back general engineer scheduling later (Phase D) without a second
-- sessions table. booking_id links to the existing Square-sourced
-- bookings table where applicable (a studio session that was also
-- booked through Square).
-- ---------------------------------------------------------------------

create table public.project_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete cascade,
  song_id uuid references public.project_songs (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  engineer_id uuid references public.profiles (id) on delete set null,
  session_type text not null default 'recording' check (session_type in ('recording', 'editing', 'mixing', 'mastering', 'consultation', 'other')),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint project_sessions_time_order check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

comment on table public.project_sessions is 'duration is deliberately not a stored column — compute from starts_at/ends_at to avoid drift. Customer is reachable via project_id -> customer_id or booking_id -> customer_id, not duplicated here.';

create trigger project_sessions_set_updated_at
  before update on public.project_sessions
  for each row execute procedure public.set_updated_at();

create index project_sessions_project_id_idx on public.project_sessions (project_id) where deleted_at is null;
create index project_sessions_song_id_idx on public.project_sessions (song_id);
create index project_sessions_booking_id_idx on public.project_sessions (booking_id);
create index project_sessions_engineer_id_idx on public.project_sessions (engineer_id);
create index project_sessions_starts_at_idx on public.project_sessions (starts_at) where deleted_at is null;

-- ---------------------------------------------------------------------
-- 5. project_revisions — a revision *round* tracker (a client asked for
-- changes). Fine-grained timestamped audio feedback is Phase B's
-- audio_comments; this is the coarser "revision N requested/completed"
-- record referenced by the Project stages list ("Revision").
-- ---------------------------------------------------------------------

create table public.project_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  song_id uuid references public.project_songs (id) on delete set null,
  revision_number int not null,
  description text,
  status text not null default 'requested' check (status in ('requested', 'in_progress', 'completed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger project_revisions_set_updated_at
  before update on public.project_revisions
  for each row execute procedure public.set_updated_at();

create index project_revisions_project_id_idx on public.project_revisions (project_id);
create index project_revisions_song_id_idx on public.project_revisions (song_id);
create unique index project_revisions_project_song_number_key on public.project_revisions (project_id, coalesce(song_id, '00000000-0000-0000-0000-000000000000'::uuid), revision_number);

-- ---------------------------------------------------------------------
-- 6. project_deliveries — reuses the existing gallery system for actual
-- file storage/sharing (Phase 4) rather than duplicating it; this table
-- just records the delivery *event* (what/when/by whom), optionally
-- pointing at the gallery the files were shared through. Phase B adds a
-- dedicated audio-specific delivery_links table for the richer
-- version/approval workflow — this one stays intentionally simple.
-- ---------------------------------------------------------------------

create table public.project_deliveries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  delivery_type text not null default 'other' check (delivery_type in ('rough_mix', 'final_mix', 'master', 'stems', 'full_package', 'other')),
  gallery_id uuid references public.galleries (id) on delete set null,
  delivered_by uuid references public.profiles (id) on delete set null,
  delivered_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index project_deliveries_project_id_idx on public.project_deliveries (project_id);
create index project_deliveries_gallery_id_idx on public.project_deliveries (gallery_id);

-- ---------------------------------------------------------------------
-- 7. Row Level Security — every new table gated on the existing
-- 'projects' permission, since they're all accessed through a project.
-- ---------------------------------------------------------------------

alter table public.project_songs enable row level security;
alter table public.project_sessions enable row level security;
alter table public.project_revisions enable row level security;
alter table public.project_deliveries enable row level security;

create policy "project_songs_select" on public.project_songs
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'view'));
create policy "project_songs_insert" on public.project_songs
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'projects', 'create'));
create policy "project_songs_update" on public.project_songs
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'edit'))
  with check (public.has_permission(public.auth_role(), 'projects', 'edit'));
create policy "project_songs_delete" on public.project_songs
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'delete'));

create policy "project_sessions_select" on public.project_sessions
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'view'));
create policy "project_sessions_insert" on public.project_sessions
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'projects', 'create'));
create policy "project_sessions_update" on public.project_sessions
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'edit'))
  with check (public.has_permission(public.auth_role(), 'projects', 'edit'));
create policy "project_sessions_delete" on public.project_sessions
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'delete'));

create policy "project_revisions_select" on public.project_revisions
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'view'));
create policy "project_revisions_insert" on public.project_revisions
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'projects', 'create'));
create policy "project_revisions_update" on public.project_revisions
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'edit'))
  with check (public.has_permission(public.auth_role(), 'projects', 'edit'));
create policy "project_revisions_delete" on public.project_revisions
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'delete'));

create policy "project_deliveries_select" on public.project_deliveries
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'view'));
create policy "project_deliveries_insert" on public.project_deliveries
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'projects', 'create'));
create policy "project_deliveries_update" on public.project_deliveries
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'edit'))
  with check (public.has_permission(public.auth_role(), 'projects', 'edit'));
create policy "project_deliveries_delete" on public.project_deliveries
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'projects', 'delete'));

-- ---------------------------------------------------------------------
-- 8. activities: extend the write policy so song/session/revision/
-- delivery events can log to the customer timeline the same way every
-- other module does (see 0005_phase2_activities_write.sql).
-- ---------------------------------------------------------------------

drop policy "activities_insert" on public.activities;
create policy "activities_insert" on public.activities
  for insert to authenticated
  with check (
    public.has_permission(public.auth_role(), 'customers', 'create')
    or public.has_permission(public.auth_role(), 'customers', 'edit')
    or public.has_permission(public.auth_role(), 'bookings', 'create')
    or public.has_permission(public.auth_role(), 'bookings', 'edit')
    or public.has_permission(public.auth_role(), 'projects', 'create')
    or public.has_permission(public.auth_role(), 'projects', 'edit')
  );
