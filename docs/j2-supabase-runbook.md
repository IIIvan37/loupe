# J2 runbook — Supabase auth for the Modal analyse offload

The J2 code is built and verified against a **local** Supabase stack. These are
the steps only the account owner can run to take it to the cloud. The shared
HS256 secret binds three sides together — set the SAME value in the Edge Function
and in Modal.

## 0. One secret, three places

Generate it **hex** (not base64 — a `=`/`+`/`/` in the value breaks
`supabase secrets set NAME=VALUE`, which splits on `=`):

```sh
openssl rand -hex 32   # -> ANALYZE_JWT_SECRET (64 chars)
```

It goes to: the Supabase Edge Function secret `ANALYZE_JWT_SECRET`, the Modal
secret `loupe-analyze-jwt`, and NOWHERE in the web bundle (the app never signs).
The two must be **identical** — verify with the sha256 digests (`supabase
secrets list` shows a digest, and `python -c "import hashlib;…"` on the value).

**Floor (U.3): both sides refuse a secret shorter than 32 characters** — the
Edge Function answers `500 server_misconfigured` on mint, and Modal's `@enter`
hook raises before loading the models. `openssl rand -hex 32` is comfortably
above it. **Before deploying the U.3 server change**, confirm the currently
deployed secret already meets the floor (it does if it came from this
runbook's `openssl rand -hex 32`) — a shorter live value would crash-loop the
container at startup.

### Rotating the secret

There is one secret and two verif points, so any rotation has a blip; order
the swaps to keep it to seconds plus the ≤5 min tail of already-minted tokens
(the app's retry path re-mints):

1. Generate the new hex value.
2. **Modal first** (the slow step — do NOT swap the Edge yet):
   `modal secret create loupe-analyze-jwt ANALYZE_JWT_SECRET='<new>' --force`
   then `cd server && .venv/bin/modal deploy modal_app.py` and wait for it.
3. **Edge immediately after**:
   `supabase secrets set ANALYZE_JWT_SECRET=<new>` (mints with it ~instantly).
4. Curl-verify (§4). Between steps 2 and 3, fresh mints still carry the old
   signature and 401 on Modal — that window is seconds if step 3 follows
   directly. Tokens minted before step 2 fail for at most 5 minutes. A
   zero-blip rotation would need Modal to verify against `{new, previous}`;
   not implemented, note it here if the beta ever can't absorb the blip.

## 1. Supabase project

```sh
supabase login
supabase link --project-ref <your-project-ref>
supabase db push                                    # applies supabase/migrations/*.sql
supabase functions deploy mint-analyze-token --use-api  # --use-api: bundle server-side
supabase secrets set ANALYZE_JWT_SECRET="$(cat server/.analyze-jwt-secret.local)"
```

> `--use-api` bundles the function server-side — needed because the local eszip
> bundler can't bind-mount under **Colima** (`failed to open eszip`).

- **Auth**: enable Email (magic link) in the dashboard; add the app origin to the
  redirect allow-list.
- **Seed a beta code** (SQL editor, service role). Codes must carry ≥ 32 chars
  of real entropy (U.3 constraint `beta_codes_code_min_length` — guessable
  codes like `FRIENDS` are refused at insert):
  `insert into beta_codes (code, uses_left) values (gen_random_uuid()::text, 25);`
  then read the generated code back to hand it out.
- **Brute-force friction (U.3)**: 5 consecutive failed redeems lock the caller
  out for 15 minutes (`public.redeem_attempts`, invisible to the Data API).
  A locked-out user gets the same `false` as a bad code — nothing to support,
  it self-heals.
- The migration's RLS means users read only their own `usage`/`beta_members`;
  only the Edge Function (service side) writes usage.

## 2. Modal — verify the minted token

`server/modal_app.py` already verifies HS256 (`app/analyze_auth.py`). Just swap
the secret and redeploy:

```sh
modal secret create loupe-analyze-jwt ANALYZE_JWT_SECRET='<the secret>'
cd server && .venv/bin/modal deploy modal_app.py
```

- Add the deployed app origin to `ALLOWED_ORIGINS` in `modal_app.py` (dev is
  `localhost:5173`).
- Set a hard **spend cap** on the Modal account (defence in depth beside the
  per-user quota).

## 3. Web — point the app at the project

`packages/web/.env.local` (gitignored):

```sh
VITE_STRUCTURE_URL=https://<your>--loupe-structure-api-web.modal.run
VITE_SUPABASE_URL=https://<project-ref>.supabase.co   # the REF, not the project name
VITE_SUPABASE_ANON_KEY=<anon key>          # public by design (RLS guards data)
```

> Deployed once already: project **Loupe** = ref `kqvpftctrkrtdwuvpnva`
> (eu-north-1). Restart the Vite dev server after writing `.env.local` so it
> picks up the vars.

With these set the header shows the account control; analysis actions gate on
sign-in → beta code → quota.

## 4. Curl-verify each link (as done locally)

```sh
# mint (needs a user access token from a signed-in session)
curl -XPOST "$VITE_SUPABASE_URL/functions/v1/mint-analyze-token" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer <user-jwt>"
# -> 200 {token,...} | 403 not a member | 429 quota

# structure with the minted token
curl -XPOST "$VITE_STRUCTURE_URL/structure" \
  -H "Authorization: Bearer <minted-token>" --data-binary @mix.wav
# -> 200 {segments:[...]}  ; a forged/expired token -> 401
```

## Local development stack (what the code was verified against)

- `supabase start` (Colima: set `[analytics] enabled = false` in
  `supabase/config.toml` — the vector container can't bind-mount the docker
  socket).
- Migrations verified: `docker exec -i supabase_db_loupe psql -U postgres -d
  postgres -v ON_ERROR_STOP=1 < supabase/tests/j2_auth_quota.sql` (idem
  `u3_redeem_throttle.sql`).
- Edge Function verified by running its handler under Deno against the live
  stack — seed the two harness users first with
  `./scripts/seed-supabase-deno-harness.sh`, then:
  `deno test --config supabase/functions/deno.json --allow-net
  --allow-env supabase/functions/mint-analyze-token/index.test.ts`
  (the CLI's `functions serve` can't bind-mount under Colima).
- Modal verifier: `cd server && .venv/bin/python -m pytest
  tests/test_analyze_auth.py`.
