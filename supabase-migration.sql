-- ============================================================
-- SpendWise — Supabase schema for public.budget_data
--
-- Reflects the live database as of 2026-11-03 (migration
-- "secure_budget_data_rls"). Safe to re-run on a fresh project.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- 1. Table: one row per user, all data stored as JSONB
create table if not exists public.budget_data (
  user_id    uuid  primary key references auth.users(id) on delete cascade,
  expenses   jsonb not null default '[]'::jsonb,
  income     jsonb not null default '[]'::jsonb,
  categories jsonb not null default '[]'::jsonb,
  settings   jsonb          default '{}'::jsonb
);

-- 1b. Added 2026-11-03 (migration add_recurring_and_goals_columns)
alter table public.budget_data add column if not exists recurring jsonb not null default '[]'::jsonb;
alter table public.budget_data add column if not exists goals     jsonb not null default '[]'::jsonb;

-- 2. Row Level Security: logged-in users can only touch their own row
alter table public.budget_data enable row level security;

drop policy if exists "Users can view own data"   on public.budget_data;
drop policy if exists "Users can insert own data" on public.budget_data;
drop policy if exists "Users can update own data" on public.budget_data;
drop policy if exists "Users can delete own data" on public.budget_data;

create policy "Users can view own data" on public.budget_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own data" on public.budget_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own data" on public.budget_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own data" on public.budget_data
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 3. Privileges: anonymous visitors get nothing; TRUNCATE bypasses RLS so remove it
revoke all on public.budget_data from anon;
revoke truncate, references, trigger on public.budget_data from authenticated;
grant select, insert, update, delete on public.budget_data to authenticated;

-- NEVER add a permissive "using (true)" policy to this table — it exposes
-- every user's financial data to anyone holding the public anon key.

-- 1c. Added 2026-11-03 (migration add_reserve_transfers_column)
-- DEPRECATED 2026-11-03: unused since the existing-balance refactor; safe to drop later.
alter table public.budget_data add column if not exists reserve_transfers jsonb not null default '[]'::jsonb;
