# J2 runbook — Supabase auth for the Modal analyse offload

The J2 code is built and verified against a **local** Supabase stack. These are
the steps only the account owner can run to take it to the cloud. The shared
HS256 secret binds three sides together — set the SAME value in the Edge Function
and in Modal.

## 0. One secret, three places

Generate it **hex** (not base64 — a `=`/`+`/`/` in the value breaks
`supabase secrets set NAME=VALUE`, which splits on `=`):

```sh
openssl rand -hex 32   # -> ANALYZE_JWT_SECRET
```

It goes to: the Supabase Edge Function secret `ANALYZE_JWT_SECRET`, the Modal
secret `loupe-analyze-jwt`, and NOWHERE in the web bundle (the app never signs).
The two must be **identical** — verify with the sha256 digests (`supabase
secrets list` shows a digest, and `python -c "import hashlib;…"` on the value).

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
- **Seed a beta code** (SQL editor, service role):
  `insert into beta_codes (code, uses_left) values ('FRIENDS', 25);`
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
  postgres < supabase/tests/j2_auth_quota.sql`.
- Edge Function verified by running its handler under Deno against the live
  stack: `deno test --config supabase/functions/deno.json --allow-net
  --allow-env supabase/functions/mint-analyze-token/index.test.ts`
  (the CLI's `functions serve` can't bind-mount under Colima).
- Modal verifier: `cd server && .venv/bin/python -m pytest
  tests/test_analyze_auth.py`.
