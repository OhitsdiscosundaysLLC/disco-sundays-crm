-- Phase 7 — Referrals & Rewards
-- Disco Sundays CRM
-- Adds: customers.referral_code (stable shareable code per customer),
-- referrals, reward_accounts, reward_transactions. Reward amounts and
-- qualification rules are not defined by the business yet — nothing here
-- invents a fixed dollar/point value; staff enter amounts when issuing a
-- reward. See docs/DECISIONS.md D-018.
--
-- Rewards are an append-only ledger (D-008, already decided): a customer's
-- balance is a cache maintained only by a trigger off reward_transactions
-- inserts, never directly writable by any app role.
--
-- The public /r/[code] -> /join redirect described in docs/ARCHITECTURE.md
-- §4 is intentionally NOT built in this migration/phase — /join (public
-- registration) doesn't exist yet in this project (deferred since Phase 1),
-- so a working /r/[code] would have nowhere real to send someone. Building
-- it now would be exactly the "decorative functionality" spec RULE 2
-- forbids. Referral codes are generated and usable for internal/manual
-- tracking today; the public self-service link lands once /join exists.

-- ---------------------------------------------------------------------
-- 1. customers.referral_code — one stable, shareable code per customer
-- ---------------------------------------------------------------------

alter table public.customers
  add column referral_code text;

create unique index customers_referral_code_key on public.customers (referral_code) where deleted_at is null and referral_code is not null;

-- ---------------------------------------------------------------------
-- 2. referrals
-- ---------------------------------------------------------------------

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_customer_id uuid not null references public.customers (id) on delete restrict,
  referred_customer_id uuid not null references public.customers (id) on delete restrict,
  code text,
  source text,
  qualification_status text not null default 'pending' check (qualification_status in ('pending', 'qualified', 'rejected')),
  related_payment_id uuid references public.payments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referrals_no_self_referral check (referrer_customer_id != referred_customer_id)
);

comment on table public.referrals is 'A customer can only be the "referred" party once — enforced by the unique index below — so competing/duplicate referral claims are rejected at the database level, not just in app logic.';

create trigger referrals_set_updated_at
  before update on public.referrals
  for each row execute procedure public.set_updated_at();

create unique index referrals_referred_customer_key on public.referrals (referred_customer_id);
create index referrals_referrer_customer_idx on public.referrals (referrer_customer_id);
create index referrals_qualification_status_idx on public.referrals (qualification_status);

-- ---------------------------------------------------------------------
-- 3. reward_accounts / reward_transactions
-- ---------------------------------------------------------------------

create table public.reward_accounts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customers (id) on delete restrict,
  balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.reward_accounts is 'balance is a cache maintained ONLY by the reward_transactions_apply trigger below — never directly updatable by any app role (no update policy granted to authenticated). Source of truth is reward_transactions.';

create table public.reward_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  type text not null check (type in ('earned', 'bonus', 'referral_reward', 'redemption', 'adjustment', 'expiration')),
  amount numeric(12,2) not null,
  reason text,
  related_referral_id uuid references public.referrals (id) on delete set null,
  related_booking_id uuid references public.bookings (id) on delete set null,
  related_order_id text,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.reward_transactions is 'Append-only ledger (D-008) — no update/delete policy for any app role. amount is signed: positive for earned/bonus/referral_reward, negative for redemption/expiration/negative adjustment.';

create index reward_transactions_customer_id_idx on public.reward_transactions (customer_id);
create index reward_transactions_related_referral_idx on public.reward_transactions (related_referral_id);
create index reward_transactions_related_booking_idx on public.reward_transactions (related_booking_id);
create index reward_transactions_actor_id_idx on public.reward_transactions (actor_id);

-- Idempotency: at most one referral_reward transaction per referral, so
-- re-clicking "issue reward" (or a future automated retry) can never
-- double-pay the same referral.
create unique index reward_transactions_one_referral_reward_key
  on public.reward_transactions (related_referral_id)
  where type = 'referral_reward' and related_referral_id is not null;

-- Trigger: maintain reward_accounts.balance as a running sum of
-- reward_transactions.amount. security definer so it can write
-- reward_accounts even though the inserting user has no update policy on
-- that table themselves — the balance is never directly settable.
create or replace function public.apply_reward_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.reward_accounts (customer_id, balance)
  values (new.customer_id, new.amount)
  on conflict (customer_id) do update
    set balance = public.reward_accounts.balance + new.amount,
        updated_at = now();
  return new;
end;
$$;

create trigger reward_transactions_apply
  after insert on public.reward_transactions
  for each row execute procedure public.apply_reward_transaction();

-- ---------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------

alter table public.referrals enable row level security;
alter table public.reward_accounts enable row level security;
alter table public.reward_transactions enable row level security;

create policy "referrals_select" on public.referrals
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'referrals', 'view'));
create policy "referrals_insert" on public.referrals
  for insert to authenticated
  with check (public.has_permission(public.auth_role(), 'referrals', 'create'));
create policy "referrals_update" on public.referrals
  for update to authenticated
  using (public.has_permission(public.auth_role(), 'referrals', 'edit'))
  with check (public.has_permission(public.auth_role(), 'referrals', 'edit'));
create policy "referrals_delete" on public.referrals
  for delete to authenticated
  using (public.has_permission(public.auth_role(), 'referrals', 'delete'));

-- reward_accounts: read-only for the app — balance is trigger-maintained
-- only, never directly written by any app role.
create policy "reward_accounts_select" on public.reward_accounts
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'rewards', 'view'));

create policy "reward_transactions_select" on public.reward_transactions
  for select to authenticated
  using (public.has_permission(public.auth_role(), 'rewards', 'view'));
create policy "reward_transactions_insert" on public.reward_transactions
  for insert to authenticated
  with check (
    public.has_permission(public.auth_role(), 'rewards', 'create')
    and (actor_id = (select auth.uid()) or actor_id is null)
  );
-- No update/delete policy on reward_transactions: append-only ledger, D-008.

-- ---------------------------------------------------------------------
-- 5. activities write policy: extend to referrals/rewards resources too
-- (same pattern as 0005/0006).
-- ---------------------------------------------------------------------

drop policy "activities_insert" on public.activities;
create policy "activities_insert" on public.activities
  for insert to authenticated
  with check (
    public.has_permission(public.auth_role(), 'customers', 'create')
    or public.has_permission(public.auth_role(), 'customers', 'edit')
    or public.has_permission(public.auth_role(), 'bookings', 'create')
    or public.has_permission(public.auth_role(), 'bookings', 'edit')
    or public.has_permission(public.auth_role(), 'referrals', 'create')
    or public.has_permission(public.auth_role(), 'referrals', 'edit')
    or public.has_permission(public.auth_role(), 'rewards', 'create')
  );
