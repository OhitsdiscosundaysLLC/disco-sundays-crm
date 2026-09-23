-- Phase 2 hardening
-- Disco Sundays CRM
-- Fixes advisor findings from 0003: missing FK indexes, and "for all"
-- policies overlapping with a dedicated select policy on the same table
-- (multiple_permissive_policies — each overlapping policy is evaluated on
-- every query, which is wasted work). Splits each "for all" write policy
-- into insert/update/delete only, select stays owned by the *_select policy.

create index customer_tags_tag_id_idx on public.customer_tags (tag_id);
create index notes_author_id_idx on public.notes (author_id);

drop policy "lead_statuses_write" on public.lead_statuses;
create policy "lead_statuses_insert" on public.lead_statuses
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'settings', 'edit'));
create policy "lead_statuses_update" on public.lead_statuses
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'settings', 'edit'))
  with check (public.has_permission(public.auth_role(), 'settings', 'edit'));
create policy "lead_statuses_delete" on public.lead_statuses
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'settings', 'edit'));

drop policy "tags_write" on public.tags;
create policy "tags_insert" on public.tags
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'customers', 'edit'));
create policy "tags_update" on public.tags
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'customers', 'edit'))
  with check (public.has_permission(public.auth_role(), 'customers', 'edit'));
create policy "tags_delete" on public.tags
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'customers', 'edit'));

drop policy "customer_tags_write" on public.customer_tags;
create policy "customer_tags_insert" on public.customer_tags
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'customers', 'edit'));
create policy "customer_tags_update" on public.customer_tags
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'customers', 'edit'))
  with check (public.has_permission(public.auth_role(), 'customers', 'edit'));
create policy "customer_tags_delete" on public.customer_tags
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'customers', 'edit'));
