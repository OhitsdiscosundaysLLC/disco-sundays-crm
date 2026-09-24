-- Phase 7 hardening
-- Disco Sundays CRM
-- apply_reward_transaction() is trigger-only (like handle_new_user() and
-- set_updated_at() before it — see 0002_harden_foundation.sql) and should
-- never be directly callable via PostgREST RPC. Advisor caught this
-- immediately after 0009 applied — fixed same pass, same as every prior
-- phase's hardening step.

revoke execute on function public.apply_reward_transaction() from public;
revoke execute on function public.apply_reward_transaction() from anon;
revoke execute on function public.apply_reward_transaction() from authenticated;
