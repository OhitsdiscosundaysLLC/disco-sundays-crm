-- Phase 2 — activities write policy
-- Disco Sundays CRM
-- 0001_foundation.sql created activities with only a select policy, noting
-- "gated on the 'customers' resource until Phase 2 adds a real per-customer
-- FK/policy" — the FK was added in 0003 but the insert policy was missed.
-- Without this, the application (running under the signed-in user's own
-- session, never the service role — see docs/SECURITY.md) cannot write a
-- single customer-timeline row, which spec §8/§9 requires for every
-- customer-affecting action (customer created, note added, tag changed,
-- lead converted). This is purely additive and mirrors the existing
-- has_permission()-gated policy style used throughout Phase 2.

create policy "activities_insert" on public.activities
  for insert to authenticated
  with check (
    public.has_permission(public.auth_role(), 'customers', 'create')
    or public.has_permission(public.auth_role(), 'customers', 'edit')
  );

-- No update/delete policy: activities is append-only, same as audit_logs.
