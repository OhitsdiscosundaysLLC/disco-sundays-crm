-- Tasks module
-- Disco Sundays CRM
-- Adds: task_statuses (configurable, same pattern as booking_statuses/
-- project_statuses), tasks. Optionally linked to a customer/lead/project/
-- booking via a polymorphic related_type/related_id pair, same pattern as
-- payments.related_type/related_id (0006_phase3_services_bookings_payments.sql).
-- role_permissions already has 'tasks' rows seeded for every role in
-- 0001_foundation.sql — no permissions migration needed here.

create table public.task_statuses (
  slug text primary key,
  label text not null,
  sort_order int not null,
  is_terminal boolean not null default false
);

insert into public.task_statuses (slug, label, sort_order, is_terminal) values
  ('todo', 'To do', 1, false),
  ('in_progress', 'In progress', 2, false),
  ('done', 'Done', 3, true),
  ('cancelled', 'Cancelled', 4, true);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'todo' references public.task_statuses (slug),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assignee_id uuid references public.profiles (id) on delete set null,
  due_date date,
  related_type text check (related_type in ('customer', 'lead', 'project', 'booking')),
  related_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.tasks is 'related_id is polymorphic (customer/lead/project/booking) so it intentionally has no FK constraint, same pattern as payments.related_id.';

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute procedure public.set_updated_at();

create index tasks_assignee_id_idx on public.tasks (assignee_id) where deleted_at is null;
create index tasks_status_idx on public.tasks (status) where deleted_at is null;
create index tasks_due_date_idx on public.tasks (due_date) where deleted_at is null;
create index tasks_related_idx on public.tasks (related_type, related_id);

alter table public.task_statuses enable row level security;
alter table public.tasks enable row level security;

create policy "task_statuses_select" on public.task_statuses
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'tasks', 'view'));
create policy "task_statuses_insert" on public.task_statuses
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'settings', 'edit'));
create policy "task_statuses_update" on public.task_statuses
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'settings', 'edit'))
  with check (public.has_permission(public.auth_role(), 'settings', 'edit'));
create policy "task_statuses_delete" on public.task_statuses
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'settings', 'edit'));

create policy "tasks_select" on public.tasks
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'tasks', 'view'));
create policy "tasks_insert" on public.tasks
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'tasks', 'create'));
create policy "tasks_update" on public.tasks
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'tasks', 'edit'))
  with check (public.has_permission(public.auth_role(), 'tasks', 'edit'));
create policy "tasks_delete" on public.tasks
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'tasks', 'delete'));
