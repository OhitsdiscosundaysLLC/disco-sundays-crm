-- Covering indexes for FKs flagged by the Supabase performance advisor
-- after 0013/0014 (unindexed_foreign_keys lint).
create index tasks_created_by_idx on public.tasks (created_by);
create index automation_rules_created_by_idx on public.automation_rules (created_by);
