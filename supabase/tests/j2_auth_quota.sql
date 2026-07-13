-- Verification for the J2.1 auth/quota migration. Run against the local stack:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/j2_auth_quota.sql
-- Any failing `assert` raises and aborts. Wrapped in a rolled-back transaction
-- so it leaves no trace.

begin;

-- Two throwaway users straight in auth.users (local only).
insert into auth.users (id, email, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'member@test',    'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'outsider@test',  'authenticated', 'authenticated');

insert into public.beta_codes (code, uses_left) values ('GOLDEN', 1);

-- Helper: become a given user for the RLS/auth.uid() sensitive calls.
create or replace function pg_temp.as_user(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text,
    true
  );
end $$;

do $$
declare
  r record;
  i int;
begin
  -- 1) First-time redeem succeeds and consumes the code.
  perform pg_temp.as_user('11111111-1111-1111-1111-111111111111');
  assert public.redeem_beta_code('GOLDEN') = true, 'redeem should succeed';

  reset role;
  assert (select uses_left from public.beta_codes where code = 'GOLDEN') = 0,
    'code should be drained to 0';
  assert exists (select 1 from public.beta_members
                 where user_id = '11111111-1111-1111-1111-111111111111'),
    'member row should exist';

  -- 2) Redeem is idempotent: same user again = still true, no extra consumption
  --    (already 0, so this also proves it does not go negative).
  perform pg_temp.as_user('11111111-1111-1111-1111-111111111111');
  assert public.redeem_beta_code('GOLDEN') = true, 'idempotent redeem stays true';
  reset role;
  assert (select count(*) from public.beta_members
          where user_id = '11111111-1111-1111-1111-111111111111') = 1,
    'still exactly one membership';

  -- 3) An exhausted / unknown code fails for a fresh user.
  perform pg_temp.as_user('22222222-2222-2222-2222-222222222222');
  assert public.redeem_beta_code('GOLDEN') = false, 'drained code should fail';
  assert public.redeem_beta_code('NOPE')   = false, 'unknown code should fail';
  reset role;

  -- 4) Non-member cannot consume an analysis (403 path): allowed=false, used=0.
  perform pg_temp.as_user('22222222-2222-2222-2222-222222222222');
  select * into r from public.consume_analysis();
  assert r.allowed = false and r.used = 0, 'non-member gets allowed=false, used=0';
  reset role;

  -- 5) The member consumes up to the monthly quota, then is capped.
  for i in 1..(select public.monthly_quota()) loop
    perform pg_temp.as_user('11111111-1111-1111-1111-111111111111');
    select * into r from public.consume_analysis();
    reset role;
    assert r.allowed = true, format('consume %s should be allowed', i);
    assert r.used = i, format('used should equal %s, got %s', i, r.used);
  end loop;

  -- One past the quota: denied, count unchanged, distinguishable from a
  -- non-member because used > 0 (this is the 429 path).
  perform pg_temp.as_user('11111111-1111-1111-1111-111111111111');
  select * into r from public.consume_analysis();
  reset role;
  assert r.allowed = false, 'over-quota should be denied';
  assert r.used = public.monthly_quota(), 'count stays at the cap';
  assert r.used > 0, 'over-quota is distinguishable from non-member (used > 0)';

  raise notice 'J2.1 asserts passed';
end $$;

rollback;
