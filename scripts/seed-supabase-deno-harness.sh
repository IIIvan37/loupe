#!/usr/bin/env bash
# Seed the LOCAL Supabase stack for the mint-analyze-token Deno suite:
#   - member@loupe.test  (beta member, usage reset)
#   - outsider@loupe.test (signed-in, NOT a member)
# Both password123. Idempotent. Run after `supabase start` / `supabase db reset`:
#   ./scripts/seed-supabase-deno-harness.sh
# then:
#   deno test --config supabase/functions/deno.json --allow-net --allow-env \
#     supabase/functions/mint-analyze-token/index.test.ts
set -euo pipefail

API=http://127.0.0.1:54321
# The local stack's well-known demo service_role key (not a secret).
SR='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
CODE='deno-harness-aaaa-bbbb-cccc-dddddddd' # >= 32 chars (beta_codes_code_min_length)

for email in member@loupe.test outsider@loupe.test; do
  status=$(curl -s -o /dev/null -w '%{http_code}' -XPOST "$API/auth/v1/admin/users" \
    -H "apikey: $SR" -H "Authorization: Bearer $SR" \
    -H 'content-type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"password123\",\"email_confirm\":true}")
  # 200 = created; 422 = already exists (re-run). Anything else is a real
  # failure (stack down, rotated key) — do not print "seeded" over it.
  if [[ "$status" != 200 && "$status" != 422 ]]; then
    echo "admin user create failed for $email (HTTP $status)" >&2
    exit 1
  fi
done

docker exec -i supabase_db_loupe psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<SQL
insert into public.beta_codes (code, uses_left) values ('$CODE', 5)
  on conflict do nothing;
insert into public.beta_members (user_id, code)
  select id, '$CODE' from auth.users where email = 'member@loupe.test'
  on conflict do nothing;
delete from public.usage;
delete from public.redeem_attempts;
SQL

echo "harness seeded: member@loupe.test (beta) / outsider@loupe.test"
