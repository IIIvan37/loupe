# Session — 2026-07-31 — retrait complet de Tauri (le binaire loupe, seul livrable)

## Done

- **Décision (en séance) : le « sommeil » devient un retrait** — vérifié
  d'abord que Tauri n'entrait nulle part dans le livrable
  (`build-loupe-binary.sh` = web `VITE_SHELL=server` embarqué dans
  `loupe-server`, zéro dep Cargo, zéro mention RELEASING). Branche
  `chore/retrait-tauri`, PR #327 ouverte.
- **Tombent** : `packages/desktop` (pnpm + Cargo), scripts racine, workflow
  `desktop.yml`, `target/` (5,1 Go), 3 deps `@tauri-apps/*`, les ~20
  adaptateurs web gardés par `tauri-env` (track-source, download-bridge,
  stores fs + GC sweep, deep-link PKCE, desktop-export, menus natifs,
  close-guard), `deliver-file` (→ `downloadBlob` direct, le contrat
  d'annulation était desktop-only), `to-array-buffer` (orphelin), les
  origines `tauri://` des TROIS allowlists CORS (`origins.py`, `config.rs`,
  Edge Function + leurs tests).
- **Renommages honnêtes** : prop shell `desktop` → `localBackend` (spec
  `workstation-shell.backend-gating.spec.tsx`), `QuitGuard` → `UnloadGuard`
  (le dialog de fermeture native était desktop-only ; hébergé en composant
  pour rester sous le cliquet 25-hooks du shell).
- **Revue MDN (utilisateur)** : `beforeunload` perd `event.returnValue`
  (legacy Chrome/Edge < 119) — l'exemption Sonar fp9 (S1874) tombe avec.
- README réécrit (crates = distribution, `loupe` binaire nominal),
  runbook Supabase §0bis simplifié, beta-checklist : section desktop close.
- Mémoire projet `jalon3-projects-domain-first` mise à jour (fork adapter
  soldé — ne plus proposer de piste Tauri).

## Not done / remaining

- **Action opérateur** : un redeploy Modal + Edge Function pour prendre le
  défaut d'origins sans `tauri://` (aucun secret à toucher ; l'ancien défaut
  reste inerte d'ici là).
- Question ouverte (utilisateur, en séance) : **doublons backend Python
  (`server/`) vs Rust (`crates/`)** — inventaire au prochain pas.

## Decisions

- Le retrait est acté dans STATUS (« le binaire `loupe` est le seul
  livrable ») ; pas d'ADR dédié — c'est la conséquence du cap distribution
  (D1–D6), le rapport et la PR portent le détail.

## Gate status

- `pnpm gate` ✅ complet (tampon `f116fbc9`) : typecheck ✅ · biome ✅ ·
  sheriff ✅ (arête `web:feature:desktop` retirée) · design/react ✅ ·
  tokens/i18n ✅ · knip ✅ · jscpd ✅.
- tests : ✅ 1096 web + docs/config ; `pnpm --filter @app/web build` ✅ ;
  `cargo test -p loupe-server` ✅. Tests python : CI (venv absent ici, choix).
- mutation : **sans objet** — aucune source core touchée.
- sonar : analyse PR #327 en cours au moment du rapport — à relire avant
  merge.

## State to resume from

- **Single next action** : inventaire des doublons Python/Rust (origins,
  politique yt-dlp, endpoints projects/download) — puis garde-fous beta ou
  1re release taguée.
- Gotchas :
  - `git rm` d'un paquet ne vide pas ses artefacts gitignorés — biome scanne
    ce qui reste sur disque une fois l'ignore retiré (`rm -rf` ensuite).
  - react-doctor attrape les modules orphelins AVANT knip dans le gate.
