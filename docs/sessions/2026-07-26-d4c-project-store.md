# Session — 2026-07-26 — d4c-project-store

## Done

- **D4.c livré (PR #280, branche `feat/d4c-project-store`)** — les stores
  projets du serveur route 2 : le binaire `loupe` sert désormais une UI
  complète (projets/sauvegarde comprises).
  - **`project_store.rs`** : `/projects` CRUD + `/gc`, parité contrat
    `projects.py` — ids `[A-Za-z0-9_-]{1,128}` (404 sinon), manifestes
    opaques persistés **verbatim** (validation syntaxique `IgnoredAny`, sans
    DOM), écriture atomique, listing trié qui saute un manifeste corrompu,
    même `~/.loupe/projects/` → migration zéro code (vérifié : manifeste
    seedé à la main relu par le binaire).
  - **GC conservateur** : refs = tout string sha256-shaped du JSON
    (`referenced_refs`), abort sans rien supprimer si un manifeste ne se lit
    pas — y compris une entrée `*.json` illisible (répertoire, permissions),
    que le premier jet ignorait silencieusement (trouvé en revue, plus
    conservateur que prévu grâce à la parité stricte avec le glob Python).
  - **GC au boot dans `main.rs`** (`boot_gc`, parité lifespan hook) — trouvé
    en revue : rien n'appelait le GC dans le binaire (le client web s'appuie
    sur le sweep au boot et ne poste jamais `/gc`) ; les orphelins auraient
    rempli le quota 10 Go en silence.
  - **`fs_atomic::write_atomic` partagé** (audio + projets) : tmp à nom
    unique (pid + séquence) → deux PUT concurrents du même id ne peuvent
    plus se déchirer le `.tmp` partagé (course réelle depuis
    `spawn_blocking`, le Python était sérialisé par l'event loop).
  - **`AudioStore::sweep_orphans`** : le GC passe par le store (layout
    privé, une seule définition de « nos blobs » partagée avec le quota) ;
    `reclaimedBytes` ne compte que les suppressions effectives.
  - Handlers aplatis en `Result<Response, Response>` + mapping unique
    `ProjectError` → statut ; `load` distingue panne de lecture (500)
    d'absence (404).
  - Revue 8 angles : 10 findings (6 corrigés + 3 cleanup appliqués, 1
    documenté ci-dessous) ; vérifié de bout en bout sur le binaire (CRUD
    curl, GC au boot balaye l'orphelin seedé, Origin étranger → 403).

## Not done / remaining

- **D5** : pipeline GitHub Releases (build 3 OS sur tag, brew tap, archive
  Windows, notification de version au démarrage) ; puis D6 validation
  Linux/Windows.
- **Divergence connue (documentée, pas corrigée)** : serde_json est plus
  strict que `json.loads` — surrogate isolé (`"\ud800"`, émissible par
  `JSON.stringify`) ou récursion > 128 rendraient un manifeste legacy
  illisible (projet invisible + GC en abort permanent). Probabilité faible ;
  à surveiller si un testeur route 1 → route 2 signale un projet disparu.
- Divergences mineures assumées : corps d'erreur texte brut (vs
  `{"detail"}` FastAPI — le client ne lit que le statut, stance D4.b) ; pas
  de Range/ETag sur `/audio` (préexistant D4.b) ; ordre des clés réécrit par
  `GET /projects` (BTreeMap, cosmétique).

## Decisions

- **GC au boot, pas à la demande** : parité avec le lifespan Python — le
  boot est le seul moment sans upload en vol (un blob parqué mais pas encore
  nommé par un manifeste ressemblerait à un orphelin). La route `/gc` reste
  (parité, tests) mais aucun client ne l'appelle.
- **Tmp uniques pour toute écriture atomique** (`fs_atomic`) : la
  sérialisation implicite de l'event loop Python ne protège plus des écritures
  concurrentes une fois sur des threads — l'unicité du nom rend la course
  impossible plutôt que rare.
- **`sweep_orphans` sur `AudioStore`** : la suppression de blobs appartient
  au store qui les possède ; `project_store` ne connaît que l'ensemble
  `live`.

## Gate status

- typecheck: ✅ (gate JS complète verte via pre-commit, « ✅ Pre-commit OK »)
- tests (with coverage): JS 2388 ✅ (96,8 % stmts) ; `cargo test --workspace`
  **63** ✅ (8 loupe-download · 52 loupe-server : 28 unités lib + 3 CLI +
  21 route-level · 3 src-tauri)
- mutation (Stryker, local, if core touched): **skippé — aucun fichier
  `@app/core` touché** (Rust uniquement).
- biome / sheriff / knip / jscpd: ✅ · clippy `-D warnings` + `cargo fmt`
  propres

## State to resume from

- **Single next action**: merger PR #280, puis **D5** — workflow GitHub
  Releases : build du binaire sur tag pour macOS arm64 / Linux x64 /
  Windows x64 (`scripts/build-loupe-binary.sh` fait déjà le layout web dist
  → cargo build release), versioning tag → `--version`, brew tap +
  archive Windows, notification de version au démarrage.
- Gotchas : `web_dist/` du crate reste un artefact gitignoré à peupler via
  `scripts/build-loupe-binary.sh` avant tout build release ; le GC au boot
  tourne AVANT le bind du port (démarrage un poil plus long si gros store —
  acceptable, c'est un scan) ; tests `#[cfg(unix)]` pour les fautes de
  permissions (Windows les skippe, D6 vérifiera).
