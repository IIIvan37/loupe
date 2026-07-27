# Session — 2026-07-26 — d3-route1-packaging

## Done

- **D3 livré (PR #277, branche `feat/d3-route1-packaging`)** — la première
  beta technique est possible :
  - `server/app/cli.py` (TDD 10 tests) : entry point `loupe`, port **6173**
    (5173 reste à Vite), `--port`/`--no-browser`, port occupé → message
    actionnable, navigateur ouvert quand `/health` répond.
  - Wheel autonome 1,4 Mo (`hatchling`, deps fastapi/uvicorn/yt-dlp
    seulement — le ML reste lazy, analyses sur Modal) ; web dist packagée par
    `scripts/build-server-dist.sh` ; résolution env > packagée > monorepo en
    fonction pure (`app/web_dist.py`).
  - **Vérifié en réel** : `uv tool install` depuis la wheel → `loupe` sert
    santé + UI embarquée + les projets `~/.loupe` existants (stockage partagé
    dev/distribution), refuse un port occupé, se désinstalle proprement.
  - **Port 6173 déployé aux 4 allowlists et curl-vérifié** : défaut
    `origins.py` + miroir Deno ; `modal deploy` (préflight 200+echo) ;
    `supabase functions deploy --use-api` (204+echo) ; auth `uri_allow_list`
    += 6173 (API management, token du trousseau macOS du CLI).
  - `server/README.md` : section install 3 lignes ; purge d'une mention
    `VITE_SEPARATOR_URL` morte (AJ.3) ; knip ignore `server/**`.

## Not done / remaining

- Parcours auth+analyses complet sur 6173 non rejoué en navigateur (les
  briques sont prouvées séparément : wheel OK en curl, allowlists OK en curl,
  logique app identique au parcours D1 validé sur 5173).
- Hébergement de la wheel (GH Release) : manuel pour l'instant, automatisé
  en **D5** ; publication PyPI non tranchée.
- D4 (binaire Rust) puis D5 (pipeline release), D6 (Linux/Windows).

## Decisions

- **Port 6173** définitif (mnémonique 5173+1000, cohabite avec Vite dev).
- Wheel = deps légères ; le paquet expose le module top-level `app` —
  acceptable car `uv tool`/`uvx` isolent l'environnement (noté, disparaît
  avec la route 2 Rust).
- Nom de paquet `loupe-server`, commande `loupe`.

## Gate status

- typecheck: ✅ (gate JS complète verte)
- tests (with coverage): serveur 250 ✅ (97,8 %) ; web inchangé
- mutation (Stryker, local, if core touched): **skippé — aucun fichier
  `@app/core` touché**.
- biome / sheriff / knip / jscpd: ✅ (knip : `server/**` désormais ignoré)

## State to resume from

- **Single next action**: merger PR #277 ; ensuite au choix — faire tester la
  wheel par un premier proche (build local + envoi du fichier), ou attaquer
  **D4.a** (extraction du crate yt-dlp partagé depuis `src-tauri`).
- Gotchas :
  - Modal : ~20 s après un deploy, un conteneur chaud de l'ancienne version
    peut encore répondre — re-curl avant de conclure à un échec.
  - Edge Function : `supabase functions deploy` sans Docker local échoue au
    bundling (eszip ENOENT) → `--use-api`.
  - Token Supabase management : trousseau macOS, service « Supabase CLI »
    (`security find-generic-password -s "Supabase CLI" -w`).
  - Le build wheel laisse `server/app/web_dist/` et `server/dist/` sur le
    disque (gitignorés) — knip les ignore, mais ne jamais les committer.
