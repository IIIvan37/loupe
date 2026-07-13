-- J2.1 — Supabase foundation for the Modal analyse offload.
--
-- Three concerns, one migration:
--   * beta gating   — a user may only analyse once they redeem an invite code
--                     (product decision: table `beta_codes`, not invite-only).
--   * quota         — a beta member gets ~20 analyses per calendar month.
--   * least access  — the Data API (anon / authenticated roles) can READ a
--                     user's own usage, and redeem a code through a guarded
--                     function; it can NEVER write usage or touch beta_codes.
--                     The Edge Function (service_role, bypasses RLS) is the only
--                     writer of usage, and mints the short-lived analyse token.
--
-- Everything below lives in `public` so PostgREST exposes exactly what we grant.

set check_function_bodies = off;

-- Analyses allowed per beta member per calendar month (UTC). Kept as an
-- IMMUTABLE function so both the quota check and any dashboard read one source.
create or replace function public.monthly_quota()
returns integer
language sql
immutable
as $$ select 20 $$;

-- ---------------------------------------------------------------------------
-- Invite codes (beta gating)
-- ---------------------------------------------------------------------------
-- Seeded/managed out-of-band (service_role / SQL). No Data API grants: the
-- anon/authenticated roles never see this table directly — redemption goes
-- through redeem_beta_code() (SECURITY DEFINER) so a member can't enumerate or
-- drain codes.
create table public.beta_codes (
  code       text primary key,
  uses_left  integer not null default 1 check (uses_left >= 0),
  note       text,
  created_at timestamptz not null default now()
);
alter table public.beta_codes enable row level security;
-- No policies + RLS on = authenticated/anon get zero rows and zero writes.
-- service_role bypasses RLS for seeding.

-- ---------------------------------------------------------------------------
-- Beta membership (who has redeemed a code = who may analyse)
-- ---------------------------------------------------------------------------
create table public.beta_members (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  code        text not null references public.beta_codes (code),
  redeemed_at timestamptz not null default now()
);
alter table public.beta_members enable row level security;

-- A user may read their OWN membership row (so the UI can show "you're in").
create policy beta_members_select_own
  on public.beta_members for select
  to authenticated
  using ( (select auth.uid()) = user_id );
-- No insert/update/delete policy: only redeem_beta_code() (definer) writes here.

-- ---------------------------------------------------------------------------
-- Usage (quota consumption, one row per member per month)
-- ---------------------------------------------------------------------------
create table public.usage (
  user_id uuid    not null references auth.users (id) on delete cascade,
  period  text    not null,  -- 'YYYY-MM' in UTC
  count   integer not null default 0 check (count >= 0),
  primary key (user_id, period)
);
alter table public.usage enable row level security;

-- A user may read their OWN usage (to render "3 / 20 this month").
create policy usage_select_own
  on public.usage for select
  to authenticated
  using ( (select auth.uid()) = user_id );
-- No write policy: the Edge Function (service_role) is the only writer.

-- ---------------------------------------------------------------------------
-- redeem_beta_code(code) — the ONLY way authenticated users touch beta_codes.
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so it can read/decrement beta_codes despite RLS. Idempotent:
-- a user who already redeemed keeps their membership and consumes no extra code.
-- Returns true when the caller is a beta member on exit, false when the code is
-- unknown/exhausted. Runs in one statement-visible transaction; the row lock
-- (FOR UPDATE) serialises concurrent redemptions of the same code.
create or replace function public.redeem_beta_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_remaining integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Already a member? Idempotent success, no code consumed.
  if exists (select 1 from public.beta_members where user_id = v_uid) then
    return true;
  end if;

  -- Lock the code row so two first-time redemptions can't both pass the check.
  select uses_left into v_remaining
  from public.beta_codes
  where code = p_code
  for update;

  if v_remaining is null or v_remaining <= 0 then
    return false;  -- unknown or exhausted code
  end if;

  update public.beta_codes set uses_left = uses_left - 1 where code = p_code;
  insert into public.beta_members (user_id, code) values (v_uid, p_code);
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- consume_analysis() — atomic beta-gate + quota check-and-increment.
-- ---------------------------------------------------------------------------
-- Called by the mint-analyze-token Edge Function using the USER's JWT, so
-- auth.uid() resolves to the caller; SECURITY DEFINER lets it write `usage`
-- (which has no write policy). One row per (user, month); the FOR UPDATE lock
-- serialises concurrent mints so two requests can't both slip past the cap.
-- Returns (allowed, used, quota): allowed=false when the caller is not a beta
-- member OR is at/over quota — the Edge Function maps those to 403 / 429.
create or replace function public.consume_analysis()
returns table (allowed boolean, used integer, quota integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid    := (select auth.uid());
  v_period text    := to_char((now() at time zone 'utc'), 'YYYY-MM');
  v_quota  integer := public.monthly_quota();
  v_count  integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Beta gate: non-members never consume quota, never get a token.
  if not exists (select 1 from public.beta_members where user_id = v_uid) then
    return query select false, 0, v_quota;
    return;
  end if;

  -- Ensure the current month's row exists, then lock it for the check.
  insert into public.usage (user_id, period, count)
  values (v_uid, v_period, 0)
  on conflict (user_id, period) do nothing;

  select count into v_count
  from public.usage
  where user_id = v_uid and period = v_period
  for update;

  if v_count >= v_quota then
    return query select false, v_count, v_quota;  -- over the monthly cap
    return;
  end if;

  update public.usage set count = count + 1
  where user_id = v_uid and period = v_period
  returning count into v_count;

  return query select true, v_count, v_quota;
end;
$$;

-- ---------------------------------------------------------------------------
-- account_status() — read-only snapshot for the header chip. Membership + this
-- month's usage in one call, WITHOUT spending a quota unit (unlike
-- consume_analysis). SECURITY DEFINER so it reads beta_codes-adjacent tables
-- under RLS; scoped to the caller via auth.uid().
-- ---------------------------------------------------------------------------
create or replace function public.account_status()
returns table (member boolean, used integer, quota integer)
language sql
security definer
set search_path = ''
as $$
  select
    exists (
      select 1 from public.beta_members where user_id = (select auth.uid())
    ),
    coalesce(
      (select count from public.usage
       where user_id = (select auth.uid())
         and period = to_char((now() at time zone 'utc'), 'YYYY-MM')),
      0
    ),
    public.monthly_quota();
$$;

-- Expose ONLY the redeem + consume + status functions to signed-in users.
revoke all on function public.redeem_beta_code(text) from public;
revoke all on function public.consume_analysis() from public;
revoke all on function public.account_status() from public;
grant execute on function public.redeem_beta_code(text) to authenticated;
grant execute on function public.consume_analysis() to authenticated;
grant execute on function public.account_status() to authenticated;
grant execute on function public.monthly_quota() to authenticated, service_role;
