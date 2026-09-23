-- Phase 0 — Foundation hardening
-- Disco Sundays CRM
-- Addresses Supabase security/performance advisor findings from 0001:
--   - set_updated_at had a mutable search_path
--   - auth_role/has_permission/handle_new_user were directly callable via
--     PostgREST RPC by anon and authenticated (unintended — they're meant
--     to be used only inside RLS policies and the auth trigger)
--   - RLS policies re-evaluated auth.*() per row instead of once per query
--   - audit_logs.actor_id foreign key had no covering index
--
-- Note: the advisor also reported a pre-existing public.rls_auto_enable()
-- function that this project did not create (present on the fresh Supabase
-- project before Phase 0). It is left untouched — see docs/SECURITY.md.

-- 1. Fix mutable search_path on set_updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Lock down direct RPC access to internal helper functions.
-- auth_role/has_permission: needed only by RLS policies evaluated as the
-- authenticated role — anon has no legitimate reason to call them.
revoke execute on function public.auth_role() from public;
revoke execute on function public.auth_role() from anon;
grant execute on function public.auth_role() to authenticated;

revoke execute on function public.has_permission(public.user_role, text, text) from public;
revoke execute on function public.has_permission(public.user_role, text, text) from anon;
grant execute on function public.has_permission(public.user_role, text, text) to authenticated;

-- handle_new_user: invoked only by the auth.users trigger, which does not
-- require the invoking session to hold EXECUTE. No role needs direct access.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

-- 3. Re-scope policies to the authenticated role explicitly (so anon
-- queries against these tables are denied by RLS's normal default-deny,
-- without ever evaluating has_permission/auth_role), and wrap auth.*()
-- calls in a scalar subselect so they evaluate once per query, not once
-- per row.

drop policy "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) or public.has_permission(public.auth_role(), 'team', 'view'));

drop policy "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()) or public.has_permission(public.auth_role(), 'team', 'edit'))
  with check (id = (select auth.uid()) or public.has_permission(public.auth_role(), 'team', 'edit'));

drop policy "role_permissions_select" on public.role_permissions;
create policy "role_permissions_select" on public.role_permissions
  for select
  to authenticated
  using (public.has_permission(public.auth_role(), 'settings', 'view'));

drop policy "role_permissions_insert" on public.role_permissions;
create policy "role_permissions_insert" on public.role_permissions
  for insert
  to authenticated
  with check (public.has_permission(public.auth_role(), 'settings', 'edit'));

drop policy "role_permissions_update" on public.role_permissions;
create policy "role_permissions_update" on public.role_permissions
  for update
  to authenticated
  using (public.has_permission(public.auth_role(), 'settings', 'edit'))
  with check (public.has_permission(public.auth_role(), 'settings', 'edit'));

drop policy "role_permissions_delete" on public.role_permissions;
create policy "role_permissions_delete" on public.role_permissions
  for delete
  to authenticated
  using (public.has_permission(public.auth_role(), 'settings', 'edit'));

drop policy "audit_logs_select" on public.audit_logs;
create policy "audit_logs_select" on public.audit_logs
  for select
  to authenticated
  using (public.auth_role() in ('owner', 'admin'));

drop policy "activities_select" on public.activities;
create policy "activities_select" on public.activities
  for select
  to authenticated
  using (public.has_permission(public.auth_role(), 'customers', 'view'));

-- 4. Cover the audit_logs.actor_id foreign key with an index.
create index audit_logs_actor_id_idx on public.audit_logs (actor_id);
