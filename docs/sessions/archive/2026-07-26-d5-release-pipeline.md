# Session — 2026-07-26 — d5-release-pipeline

## Done

- **D5 livré (PR #281, branche `feat/d5-release-pipeline`)** — un tag
  `vX.Y.Z` sur un main vert produit une release complète, 3 OS.
  - **`.github/workflows/release.yml`** (déclencheur `push: tags v*`) :
    1. **job `verify`** — refuse un tag qui ne correspond pas à la version
       `crates/loupe-server/Cargo.toml` (une seule version : tag → crate →
       `--version`).
    2. **job `build`** (matrice macos-14/arm64, ubuntu-22.04/x64,
       windows/x64) — `scripts/build-loupe-binary.sh` (web dist server-shell
       + config prod embarquées), puis archive : `tar.gz` sur unix, `.zip`
       (bsdtar `-a`) sur Windows.
    3. **job `release`** — `SHA256SUMS`, formule Homebrew générée depuis le
       template (substitution version + sha des deux archives brew), GitHub
       Release (`gh release create --generate-notes`), push au tap **gardé
       par le secret** `HOMEBREW_TAP_TOKEN` (absent → formule en asset).
  - **`--version` / `-V`** (`main.rs`, enum `Command` Run/Help/Version,
    10 tests CLI adaptés) : `env!("CARGO_PKG_VERSION")`.
  - **Notification de version au démarrage** (`version_check.rs`, 4 tests,
    thread détaché best-effort) : compare avec `releases/latest` de l'API
    GitHub, une ligne si strictement plus récente ; pas d'auto-update
    (re-télécharger EST la mise à jour en beta) ; opt-out
    `LOUPE_NO_VERSION_CHECK=1`. **User-Agent explicite** (l'API GitHub 403
    sans) + `Accept: vnd.github+json`.
  - **`packages/web/.env.production`** committé (anon key + URLs publiques,
    sûrs par design) : la CI release produit la dist exacte d'un build local.
  - `packaging/homebrew/loupe.rb.tmpl` + `docs/RELEASING.md` (procédure,
    canaux, mise en place du tap).
  - Vérifié localement : binaire release buildé (7,1 Mo) sert l'UI +
    `/health` ; `--version` → `loupe 0.1.0` ; check de version silencieux
    (pas de release publiée → 404 → rien) ; génération de formule simulée
    (zéro placeholder restant, `ruby -c` OK) ; zip bsdtar OK ; actionlint OK.

## Not done / remaining

- **Tap pas encore créé** : dépôt `IIIvan37/homebrew-loupe` + secret
  `HOMEBREW_TAP_TOKEN` à mettre en place avant la première `brew install`
  (procédure dans `docs/RELEASING.md`) ; sans le secret la formule reste
  disponible en asset de Release.
- **Aucune release publiée** : le premier tag validera le pipeline en réel
  (le workflow ne peut se tester qu'au tag).
- **D6** : validation Linux + Windows (parcours réel ; yt-dlp bootstrap,
  chemins AppData, prompt pare-feu localhost, SmartScreen sur l'archive).

## Decisions

- **Notification, pas auto-update** : en beta, re-télécharger un fichier
  suffit ; le self-replace différé est repoussé (cf. plan D5).
- **Windows en archive brute d'abord** (scoop/winget si demande) ;
  SmartScreen documenté plutôt que signé.
- **ubuntu-22.04, pas -latest** : le binaire lie la glibc du runner ;
  builder sur la LTS plus ancienne élargit la compatibilité.
- **`.env.production` committé** : config client publique (anon key), CI et
  build local produisent le même bundle ; les secrets vrais restent dans
  `.env.local` (gitignoré, dev seulement).

## Gate status

- typecheck: ✅ (gate JS complète verte, exit 0)
- tests (with coverage): JS 2388 ✅ (96,8 % stmts) ; `cargo test -p
  loupe-server` **56** ✅ (32 lib + 3 CLI + 21 route-level)
- mutation (Stryker, local, if core touched): **skippé — aucun fichier
  `@app/core` touché** (Rust + workflow + config uniquement).
- biome / sheriff / knip / jscpd: ✅ · clippy `--workspace -D warnings` +
  `cargo fmt --check` propres · `actionlint` sur `release.yml` propre

## State to resume from

- **Single next action**: merger PR #281, puis **D6** — valider le parcours
  réel sur Linux puis Windows (le risque webview a disparu, restent
  yt-dlp/chemins/ports/pare-feu). D6 peut consommer le premier binaire
  produit par le pipeline.
- Gotchas : le pipeline ne se teste qu'au tag — bumper
  `crates/loupe-server/Cargo.toml` AVANT de tagger (le job `verify`
  échoue sinon) ; créer le tap + secret avant d'annoncer `brew install` ;
  `web_dist/` reste un artefact gitignoré (peuplé par le script) ; l'API
  GitHub exige le User-Agent (déjà câblé).
