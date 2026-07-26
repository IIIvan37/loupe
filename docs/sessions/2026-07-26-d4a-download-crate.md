# Session — 2026-07-26 — d4a-download-crate

## Done

- **D4.a livré (PR #278, branche `feat/d4a-download-crate`)** — le moteur
  yt-dlp durci en T2.3 devient le crate partagé `crates/loupe-download` :
  - Workspace Cargo à la racine (membres : le crate + `src-tauri`) ;
    `Cargo.lock` et `rustfmt.toml` remontés ; `/target/` gitignoré **et**
    exclu de biome (730 faux positifs de formatter sinon — piège du
    workspace : le target arrive à la racine).
  - Extraction à l'identique : allowlist d'hôtes, pins sha256, bootstrap +
    self-update, budget, annulation `Notify`, sweep, parsing progrès. Zéro
    dépendance Tauri (callback de progrès + data dir en paramètre ; le
    one-at-a-time reste à l'appelant).
  - `src-tauri/download.rs` : 470 → 76 lignes (adaptateur pur).
  - CI desktop élargie au workspace (fmt/clippy/test `--workspace` à la
    racine, path filters `crates/**` + fichiers workspace).

## Not done / remaining

- **D4.b** : serveur axum + `rust-embed` de la web dist, gardes D2 portées
  (loopback, Host, Origin), consommant `loupe-download`.
- **D4.c** : stores projets Rust (parité manifeste `projects/{id}.json` +
  `audio/{sha256}` — même `~/.loupe`, migration = zéro code).
- Puis D5 (pipeline release) et D6 (validation Linux/Windows).

## Decisions

- Le crate expose `download_track(data_dir, url, progress, cancel)` ; la
  sérialisation `DownloadedTrack` (camelCase) reste dans le crate — c'est le
  contrat webview ET le futur contrat NDJSON du serveur qui la consommeront.

## Gate status

- typecheck: ✅ (gate JS complète verte)
- tests (with coverage): `cargo test --workspace` 9 ✅ ; suites JS/serveur
  inchangées
- mutation (Stryker, local, if core touched): **skippé — aucun fichier
  `@app/core` touché** (Rust uniquement).
- biome / sheriff / knip / jscpd: ✅ · clippy `-D warnings` + `cargo fmt`
  propres

## State to resume from

- **Single next action**: merger PR #278, puis **D4.b** — crate
  `loupe-serve` (axum) : servir la dist embarquée (`rust-embed`), porter les
  trois gardes réseau de `netguard.py`, brancher `loupe-download` sur le
  contrat NDJSON de `/download` + le store `/audio`.
- Gotchas : le build cargo pose `target/` à la RACINE du repo désormais
  (workspace) — exclu de biome et gitignoré, ne pas le re-scanner ; la CI
  desktop tourne à la racine (plus de working-directory src-tauri).
