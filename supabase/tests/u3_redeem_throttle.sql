-- Verification for the U.3 redeem-throttle migration. Run against the local
-- stack (after supabase/tests/j2_auth_quota.sql style):
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/u3_redeem_throttle.sql
-- Any failing `assert` raises and aborts. Wrapped in a rolled-back transaction
-- so it leaves no trace.

begin;

insert into auth.users (id, email, aud, role)
values
  ('33333333-3333-3333-3333-333333333333', 'burst@test',  'authenticated', 'authenticated'),
  ('44444444-4444-4444-4444-444444444444', 'legacy@test', 'authenticated', 'authenticated');

-- 36 chars (uuid-shaped): passes the new entropy constraint.
insert into public.beta_codes (code, uses_left)
values ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 5);

-- A pre-U.3 short code: exempted by the created_at cutoff, and its uses_left
-- decrement must not trip the CHECK (it re-evaluates on every UPDATE).
insert into public.beta_codes (code, uses_left, created_at)
values ('LEGACY', 1, timestamptz '2026-07-01');

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

-- 1) The entropy floor: a short code is refused at insert.
do $$
begin
  begin
    insert into public.beta_codes (code) values ('FRIENDS');
    raise exception 'short code should have been rejected';
  exception
    when check_violation then null;  -- expected
  end;
end $$;

do $$
declare
  i int;
begin
  -- 2) A burst of 4 wrong codes counts but does NOT lock; the 5th arms it.
  perform pg_temp.as_user('33333333-3333-3333-3333-333333333333');
  for i in 1..4 loop
    assert public.redeem_beta_code('wrong-' || i) = false,
      format('wrong code %s should fail', i);
  end loop;
  reset role;

  assert (select failures from public.redeem_attempts
          where user_id = '33333333-3333-3333-3333-333333333333') = 4,
    'four failures should be counted';
  assert (select locked_until from public.redeem_attempts
          where user_id = '33333333-3333-3333-3333-333333333333') is null,
    'four failures must not lock yet';

  perform pg_temp.as_user('33333333-3333-3333-3333-333333333333');
  assert public.redeem_beta_code('wrong-5') = false, 'fifth wrong code should fail';
  reset role;

  assert (select failures from public.redeem_attempts
          where user_id = '33333333-3333-3333-3333-333333333333') = 5,
    'five failures should be counted';
  assert (select locked_until from public.redeem_attempts
          where user_id = '33333333-3333-3333-3333-333333333333') > now(),
    'the fifth failure should arm the lockout';

  -- 3) ...and the burst is refused even with the CORRECT code while locked.
  perform pg_temp.as_user('33333333-3333-3333-3333-333333333333');
  assert public.redeem_beta_code('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee') = false,
    'a locked-out caller must be refused even with the right code';
  reset role;
  assert (select uses_left from public.beta_codes
          where code = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee') = 5,
    'no code consumed during lockout';

  -- 4) An expired lockout lazily resets the window: a wrong guess counts as
  --    failure 1 of a fresh window and clears the stale locked_until.
  update public.redeem_attempts
  set locked_until = now() - interval '1 second'
  where user_id = '33333333-3333-3333-3333-333333333333';

  perform pg_temp.as_user('33333333-3333-3333-3333-333333333333');
  assert public.redeem_beta_code('wrong-again') = false,
    'a wrong code after expiry still fails';
  reset role;
  assert (select failures from public.redeem_attempts
          where user_id = '33333333-3333-3333-3333-333333333333') = 1,
    'the expired window should reset the counter to 1';
  assert (select locked_until from public.redeem_attempts
          where user_id = '33333333-3333-3333-3333-333333333333') is null,
    'a sub-threshold failure should clear the stale lockout';

  -- 5) The right code now redeems and clears the ledger.
  perform pg_temp.as_user('33333333-3333-3333-3333-333333333333');
  assert public.redeem_beta_code('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee') = true,
    'redeem should succeed after the lockout expires';
  reset role;

  assert not exists (select 1 from public.redeem_attempts
                     where user_id = '33333333-3333-3333-3333-333333333333'),
    'a successful redeem should clear the attempts ledger';
  assert (select uses_left from public.beta_codes
          where code = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee') = 4,
    'the successful redeem consumes exactly one use';

  -- 6) A legacy (pre-cutoff) short code stays redeemable: the CHECK also
  --    re-evaluates on the uses_left decrement, which must not throw.
  perform pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  assert public.redeem_beta_code('LEGACY') = true,
    'a legacy short code must remain redeemable';
  reset role;
  assert (select uses_left from public.beta_codes where code = 'LEGACY') = 0,
    'the legacy code decrement should not trip the entropy CHECK';

  raise notice 'U.3 asserts passed';
end $$;

rollback;
