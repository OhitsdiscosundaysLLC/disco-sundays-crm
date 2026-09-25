-- Automation engine (spec §63) — minimal by design
-- Disco Sundays CRM
-- A rule fires an action when a matching row lands in `activities` (already
-- the trigger source for every module in this app — no new event bus).
-- v1 supports exactly one action: create a follow-up task. Not a generic
-- workflow engine — extend action_type only when a real second action is
-- needed, per RULE "don't overbuild."

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_event text not null,
  action_type text not null default 'create_task' check (action_type in ('create_task')),
  action_config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.automation_rules is 'action_config shape for create_task: {"title": text (required), "assignee_id": uuid (optional), "due_in_days": int (optional), "priority": text (optional, default normal)}.';

create trigger automation_rules_set_updated_at
  before update on public.automation_rules
  for each row execute procedure public.set_updated_at();

create index automation_rules_trigger_event_idx on public.automation_rules (trigger_event) where active;

alter table public.automation_rules enable row level security;

create policy "automation_rules_select" on public.automation_rules
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'settings', 'view'));
create policy "automation_rules_insert" on public.automation_rules
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'settings', 'edit'));
create policy "automation_rules_update" on public.automation_rules
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'settings', 'edit'))
  with check (public.has_permission(public.auth_role(), 'settings', 'edit'));
create policy "automation_rules_delete" on public.automation_rules
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'settings', 'edit'));

-- ---------------------------------------------------------------------
-- Trigger: fires on every activities insert, regardless of which role's
-- session wrote that activity row — same SECURITY DEFINER + revoked-RPC
-- posture as apply_reward_transaction() (0010_phase7_harden_reward_trigger.sql),
-- since creating a task on someone else's behalf shouldn't depend on the
-- acting user's own 'tasks' permission.
-- ---------------------------------------------------------------------

create function public.run_automation_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rule record;
begin
  for rule in
    select * from public.automation_rules
    where active and trigger_event = new.type
  loop
    if rule.action_type = 'create_task' and rule.action_config ? 'title' then
      insert into public.tasks (title, priority, assignee_id, due_date, related_type, related_id)
      values (
        rule.action_config->>'title',
        coalesce(rule.action_config->>'priority', 'normal'),
        nullif(rule.action_config->>'assignee_id', '')::uuid,
        case when rule.action_config ? 'due_in_days'
          then (current_date + ((rule.action_config->>'due_in_days')::int || ' days')::interval)::date
          else null
        end,
        case when new.customer_id is not null then 'customer' else null end,
        new.customer_id
      );
    end if;
  end loop;
  return new;
end;
$$;

revoke execute on function public.run_automation_rules() from public, anon, authenticated;

create trigger activities_run_automation
  after insert on public.activities
  for each row execute procedure public.run_automation_rules();
