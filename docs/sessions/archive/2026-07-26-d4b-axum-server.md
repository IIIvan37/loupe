# Session — 2026-07-26 — d4b-axum-server

## Done

- **D4.b livré (PR #279, branche `feat/d4b-axum-server`)** — le serveur
  route 2 : crate `crates/loupe-server`, binaire **`loupe` (6,9 Mo, UI
  embarquée)**.
  - **axum + rust-embed** : la web dist (`VITE_SHELL=server`) est embarquée à
    la compilation depuis `crates/loupe-server/web_dist/` (peuplée par
    `scripts/build-loupe-binary.sh`, parité avec le layout wheel D3) ; sans
    dist (dev, CI) l'API sert seule. `build.rs` crée le dossier pour que
    `cargo test`/clippy passent sans build web.
  - **Gardes D2 portées** garde pour garde (`netguard.py` → `netguard.rs`) :
    LoopbackOnly (adresse **pair** — hyper n'expose pas l'adresse locale ASGI,
    clôture équivalente, documentée) < TrustedHost < OriginGuard (tous les
    headers Origin, same-origin approuvé) < CORS ; mêmes env
    (`LOUPE_ALLOWED_HOSTS`/`ORIGINS`), mêmes défauts, `*` refusé fail-closed.
  - **`/download` NDJSON** : contrat de `download.py` à l'identique, branché
    sur `loupe-download` via un seam `DownloadEngine` (fake en test) ; audio
    parqué dans le MÊME store `/audio` content-addressed (`~/.loupe/audio/`)
    — zéro migration ; déconnexion client → annulation du yt-dlp enfant
    (guard au drop du stream) ; budget wall-clock unique attente comprise.
  - **Store `/audio`** POST/GET/HEAD : caps 413/507 parité `limits.py`
    (500 Mo / 10 Go, env-tunables), écriture atomique `.tmp`→rename.
  - **CLI parité `cli.py`** : port 6173, `--port`/`--no-browser`, port occupé
    → message actionnable + exit 1, navigateur ouvert quand `/health` répond,
    Ctrl-C propre ; bind direct (pas de probe TOCTOU, `--port 0` naturel).
  - **`loupe-download`** : sweep public et **gardé par âge (1 h)** — deux
    instances partageant `~/.loupe` ne peuvent plus se supprimer un download
    vif (parité `temp_sweep.py`).
  - Vérifié de bout en bout sur le binaire release : `/health`, index/assets
    embarqués (bons MIME), Host forgé → 400, Origin étranger → 403, roundtrip
    `/audio`, **vrai download YouTube** (bootstrap yt-dlp compris, 15 s) →
    blob servi, temp dir nettoyé.

## Not done / remaining

- **D4.c** : `/projects` CRUD + `/gc` (GC par scan des manifestes) en Rust —
  même `~/.loupe`, migration zéro code ; c'est ce qui manque pour que l'UI
  servie par le binaire soit complète (projets/sauvegarde).
- Puis D5 (pipeline GitHub Releases 3 OS + brew tap + notif de version) et
  D6 (validation Linux/Windows).

## Decisions

- **Adresse pair, pas adresse locale** pour LoopbackOnly : hyper/axum
  n'expose que le peer via `ConnectInfo` ; un client LAN a toujours un pair
  non-loopback, la clôture est équivalente (documenté dans `netguard.rs`).
- **Moteur injectable** (`DownloadEngine`) plutôt qu'appel direct du crate :
  les 14 tests de route tournent sans réseau ni yt-dlp.
- **`web_dist/` locale au crate** (copie par script, gitignorée, exclue de
  biome et knip — même piège que `/target/` en D4.a) plutôt qu'un embed de
  `packages/web/dist` : le dist embarqué est toujours celui buildé en mode
  `VITE_SHELL=server`, jamais un build d'un autre shell.

## Gate status

- typecheck: ✅ (gate JS complète verte, exit 0)
- tests (with coverage): JS 2388 ✅ (96,8 % stmts) ; `cargo test --workspace`
  **42** ✅ (8 loupe-download · 31 loupe-server : 14 unités lib + 3 CLI +
  14 route-level tower::oneshot · 3 src-tauri)
- mutation (Stryker, local, if core touched): **skippé — aucun fichier
  `@app/core` touché** (Rust + biome/knip config uniquement).
- biome / sheriff / knip / jscpd: ✅ · clippy `-D warnings` + `cargo fmt`
  propres · exclusions ajoutées : `crates/loupe-server/web_dist` (biome),
  `crates/**` (knip)

## State to resume from

- **Single next action**: merger PR #279, puis **D4.c** — porter
  `projects.py` en Rust dans `loupe-server` : `/projects` CRUD (manifestes
  opaques, ids `[A-Za-z0-9_-]{1,128}`), `/gc` conservateur (abort si un
  manifeste ne parse pas), refs = tout string sha256-shaped du JSON.
- Gotchas : `web_dist/` du crate est un artefact (gitignoré) — la peupler via
  `scripts/build-loupe-binary.sh` avant un build release ; ne jamais lancer
  le binaire et Vite dev sur le même port ; le binaire et l'entry point
  Python s'appellent tous deux `loupe` (canaux d'installation différents).
