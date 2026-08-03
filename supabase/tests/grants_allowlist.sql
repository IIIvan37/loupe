-- Executable least-access allowlist (design review 2026-08-03). The J2/U.3
-- migrations tell a least-access story in comments; comments drift, so this
-- test makes the story checkable: the EXACT sets of public tables, policies
-- and functions, plus who may execute what. Any new table, policy or function
-- must be added here consciously, WITH its access story.
-- Run against the local stack:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/grants_allowlist.sql
--
-- Two facts this file freezes on purpose:
--   * consume_analysis() IS callable by any signed-in browser (the Edge
--     Function invokes it with the USER's jwt, so `authenticated` needs
--     execute). A client can thus burn its own quota by direct RPC —
--     self-grief only, accepted.
--   * monthly_quota() is executable by anon (Postgres grants PUBLIC execute
--     by default and J2 never revoked it): an anonymous caller can read the
--     cap. Harmless disclosure, accepted.

begin;

do $$
declare
  v_actual text[];
begin
  -- 1) Every public table is on the allowlist and has RLS enabled.
  select coalesce(array_agg(c.relname order by c.relname), '{}')
    into v_actual
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r';
  assert v_actual = array['beta_codes', 'beta_members', 'redeem_attempts', 'usage'],
    format('unexpected set of public tables: %s', v_actual);

  select coalesce(array_agg(c.relname order by c.relname), '{}')
    into v_actual
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  assert v_actual = '{}',
    format('tables without row level security: %s', v_actual);

  -- 2) Policies: exactly the two read-your-own-row SELECTs. beta_codes and
  --    redeem_attempts stay policy-less (RLS on + no policy = invisible to
  --    the Data API; only the SECURITY DEFINER functions touch them).
  select coalesce(
      array_agg(
        format('%s:%s:%s:%s', tablename, policyname, cmd,
               array_to_string(roles, '+'))
        order by tablename, policyname),
      '{}')
    into v_actual
  from pg_policies
  where schemaname = 'public';
  assert v_actual = array[
      'beta_members:beta_members_select_own:SELECT:authenticated',
      'usage:usage_select_own:SELECT:authenticated'
    ],
    format('unexpected set of policies: %s', v_actual);

  -- 3) Functions: exactly the four of J2/U.3.
  select coalesce(array_agg(p.proname order by p.proname), '{}')
    into v_actual
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public';
  assert v_actual = array[
      'account_status', 'consume_analysis', 'monthly_quota', 'redeem_beta_code'
    ],
    format('unexpected set of public functions: %s', v_actual);

  -- 4) anon executes nothing but monthly_quota (see header).
  select coalesce(array_agg(p.proname order by p.proname), '{}')
    into v_actual
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and has_function_privilege('anon', p.oid, 'execute');
  assert v_actual = array['monthly_quota'],
    format('anon-executable functions: %s', v_actual);

  -- 5) authenticated executes exactly the four (the app's whole SQL surface).
  select coalesce(array_agg(p.proname order by p.proname), '{}')
    into v_actual
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and has_function_privilege('authenticated', p.oid, 'execute');
  assert v_actual = array[
      'account_status', 'consume_analysis', 'monthly_quota', 'redeem_beta_code'
    ],
    format('authenticated-executable functions: %s', v_actual);

  -- 6) Every SECURITY DEFINER function pins an empty search_path (a definer
  --    without it resolves objects through the caller's path — hijackable).
  select coalesce(array_agg(p.proname order by p.proname), '{}')
    into v_actual
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and (p.proconfig is null
         or not exists (select 1 from unnest(p.proconfig) cfg
                        where cfg like 'search_path=%'));
  assert v_actual = '{}',
    format('definer functions without a pinned search_path: %s', v_actual);

  raise notice 'grants allowlist asserts passed';
end $$;

rollback;
