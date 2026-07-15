# Session — 2026-07-15 — U.3 brute-force codes beta + plancher du secret

## Done

- **U.3 (roadmap v4, Lot U)** en deux volets, vérifiés sur le stack Supabase
  local (Colima) :
- **Friction brute-force** (`supabase/migrations/20260715120000_u3_redeem_throttle.sql`) :
  `redeem_beta_code` garde son contrat (booléen, idempotent, definer) mais
  passe par un ledger `public.redeem_attempts` (RLS on, zéro policy —
  invisible au Data API) : 5 échecs consécutifs → verrou 15 min, réponse
  `false` identique à un mauvais code (pas d'oracle), fenêtre expirée resetée
  paresseusement, ledger effacé au succès. **Entropie** : CHECK
  `char_length(code) >= 32` avec **cutoff `created_at < 2026-07-15`** pour les
  codes legacy — un `NOT VALID` nu aurait re-vérifié la ligne au décrément
  `uses_left` et cassé leur redeem (trouvé en revue, confirmé).
- **Tests SQL** (`supabase/tests/u3_redeem_throttle.sql`) : sous-seuil (4
  échecs ≠ verrou), rafale, bon code refusé sous verrou (zéro conso), reset de
  fenêtre (failures=1, verrou stale nettoyé), succès nettoie le ledger, code
  legacy court toujours rédimable, contrainte d'entropie à l'insert. La
  **persistance cross-transaction** du compteur (invérifiable dans le test
  mono-transaction) vérifiée bout-en-bout contre PostgREST réel : 6 RPC HTTP
  séparés → `failures=5, locked=true`.
- **Plancher du secret HS256 (≥ 32 chars), deux côtés** :
  `assert_strong_secret` (`server/app/analyze_gate.py`) levé dans le
  `@modal.enter` **avant** le chargement GPU facturé (le ValueError du seul
  install aurait tiré après — trouvé en revue) et à l'install de la gate ;
  l'Edge Function répond `500 server_misconfigured` (test Deno hors stack).
- **Harnais Deno versionné** (`scripts/seed-supabase-deno-harness.sh`, était
  ad-hoc depuis J2) : seed idempotent des deux utilisateurs de la suite,
  n'avale que le 422 « déjà existant » (tout autre échec sort en erreur).
- **Runbook** : seed `gen_random_uuid()::text`, plancher + check
  pré-déploiement du secret courant, rotation **Modal d'abord puis Edge**
  (blip = secondes + queue ≤ 5 min des tokens déjà émis ; l'ordre inverse
  laissait un trou de la durée du deploy Modal — trouvé en revue).
- **Web** : copy `account.code-invalid` élargie (« … ou trop d'essais —
  réessayer plus tard ») — le verrou renvoie le même `false`, aucun nouvel
  état.
- **Revue 3 finders → 5 fixés** (CHECK-on-UPDATE, fail-fast @enter, curl du
  harnais, ordre de rotation, asserts sous-seuil/reset) ; **écartés
  documentés** : pas d'escalade de verrou (l'entropie ≥ 32 est la défense
  primaire, le throttle n'est que de la friction — ~5 essais/15 min/compte),
  side-channel timing du verrou (mesurable mais sans enjeu ici), `now()` figé
  dans le test mono-transaction (compensé par la vérif PostgREST réelle),
  UTF-16 vs code points sur le plancher (secrets hex only).

## Not done / remaining

- **Déploiements requis au merge** (non faits — accès prod) :
  1. `supabase db push` (migration U.3) ;
  2. `supabase functions deploy mint-analyze-token --use-api` (plancher Edge) ;
  3. `cd server && .venv/bin/modal deploy modal_app.py` — couvre AUSSI le
     redéploiement U.1 (gate extraite + ordre CORS) **toujours en attente** ;
  4. re-seeder les codes beta prod longs si besoin (les legacy restent
     rédimables grâce au cutoff).
- Reste du Lot U : U.2 (CI deno — le job `deno check/lint/fmt` : les commandes
  passent déjà en local), U.4 (cliquets), U.5 (basses groupées).

## Decisions

- **Verrou par utilisateur, réponse indiscernable** : le lockout répond le
  même `false` qu'un mauvais code ; la copy UI couvre les deux sans état
  dédié. L'entropie des codes est la défense primaire, le throttle est de la
  friction.
- **Contrainte d'entropie = CHECK avec cutoff temporel**, pas `NOT VALID` :
  un CHECK s'applique à chaque INSERT/UPDATE de la ligne (y compris le
  décrément), `NOT VALID` ne dispense que du scan initial.
- Fail-fast des secrets : toute validation de config Modal se fait dans
  `@enter` avant le chargement des modèles.

## Gate status

- typecheck / biome / sheriff / knip / jscpd : **verts** (gate complète via le
  hook pre-commit — 1462 tests web).
- serveur : ruff + format verts (modal_app.py inclus), pyright **0**,
  **214 pytest** (+2), coverage 98 %.
- Supabase local : migrations `db reset` OK, suites SQL **J2.1 + U.3 passées**,
  Deno **8/8** (dont le nouveau test plancher hors stack), rafale PostgREST
  réelle vérifiée.
- mutation (Stryker) : **skippé** — core intouché.

## State to resume from

- **Single next action** : ouvrir la PR de `feat/u3-beta-brute-force`, merger,
  puis dérouler les déploiements listés ci-dessus (db push + Edge + Modal — ce
  dernier solde aussi U.1).
- Gotchas : le test J2 (`j2_auth_quota.sql`) sème désormais un code long
  (39 chars) — tout futur seed de test doit respecter le CHECK ou backdater
  `created_at`. Le harnais Deno suppose la migration U.3 appliquée
  (`supabase db reset` d'abord).
