-- U.3 — close the free oracle on redeem_beta_code + impose code entropy.
--
-- Before this migration a signed-in user could hammer redeem_beta_code()
-- unpenalised (no PostgREST rate limit, open sign-up), and nothing stopped an
-- operator from seeding guessable codes ('FRIENDS'). Two fixes:
--   * entropy   — new codes must be >= 32 chars; seed with gen_random_uuid()
--                 (see the J2 runbook). Legacy rows are exempted by a
--                 created_at cutoff: a plain NOT VALID would still re-check
--                 the row on the uses_left decrement and break their redeem.
--   * friction  — 5 consecutive failures lock the CALLER (not the code) for
--                 15 minutes. Lockout answers `false`, indistinguishable from
--                 a bad code, so the throttle leaks nothing.

set check_function_bodies = off;

alter table public.beta_codes
  add constraint beta_codes_code_min_length
  check (char_length(code) >= 32 or created_at < timestamptz '2026-07-15');

-- Per-user failure ledger. RLS on + no policies: invisible to the Data API;
-- only redeem_beta_code() (SECURITY DEFINER) reads or writes it.
create table public.redeem_attempts (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  failures     integer not null default 0 check (failures >= 0),
  locked_until timestamptz
);
alter table public.redeem_attempts enable row level security;

-- Same contract as J2.1 (boolean, idempotent, definer) with the throttle in
-- front of the code lookup. The caller's attempts row is locked FOR UPDATE so
-- a concurrent burst serialises; failures survive because the function
-- returns false instead of raising (the transaction commits).
create or replace function public.redeem_beta_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max_failures constant integer  := 5;
  v_lockout      constant interval := interval '15 minutes';
  v_uid          uuid := (select auth.uid());
  v_remaining    integer;
  v_attempts     public.redeem_attempts%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Already a member? Idempotent success, no code consumed, no throttle spent.
  if exists (select 1 from public.beta_members where user_id = v_uid) then
    return true;
  end if;

  -- Throttle gate: lock the caller's ledger row; refuse while locked out.
  -- An expired lockout lazily resets the window.
  insert into public.redeem_attempts (user_id) values (v_uid)
  on conflict (user_id) do nothing;

  select * into v_attempts
  from public.redeem_attempts
  where user_id = v_uid
  for update;

  if v_attempts.locked_until is not null then
    if v_attempts.locked_until > now() then
      return false;  -- locked out (deliberately same answer as a bad code)
    end if;
    v_attempts.failures := 0;  -- lockout expired: fresh window
  end if;

  -- Lock the code row so two first-time redemptions can't both pass the check.
  select uses_left into v_remaining
  from public.beta_codes
  where code = p_code
  for update;

  if v_remaining is null or v_remaining <= 0 then
    -- Count the failure; the Nth arms the lockout. The CASE also clears a
    -- stale locked_until on a sub-threshold failure after an expired window.
    update public.redeem_attempts
    set failures = v_attempts.failures + 1,
        locked_until = case
          when v_attempts.failures + 1 >= v_max_failures then now() + v_lockout
        end
    where user_id = v_uid;
    return false;  -- unknown or exhausted code
  end if;

  update public.beta_codes set uses_left = uses_left - 1 where code = p_code;
  insert into public.beta_members (user_id, code) values (v_uid, p_code);
  delete from public.redeem_attempts where user_id = v_uid;
  return true;
end;
$$;

-- create or replace keeps existing grants (authenticated) — no regrant needed.
