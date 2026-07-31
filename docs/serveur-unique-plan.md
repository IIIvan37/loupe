# Plan « serveur unique » — le Python devient la bibliothèque Modal, rien d'autre

> Décidé le 2026-07-31 (session retrait Tauri, PR #327) : les surfaces locales
> dupliquées entre `server/` (Python) et `crates/loupe-server` (Rust) se
> consolident côté Rust — le binaire `loupe` est le seul livrable. Ce plan est
> écrit pour être repris par une session fraîche sur une autre machine : tout
> le contexte nécessaire est ici, rien en mémoire locale.

## Constat (inventaire 2026-07-31)

`server/` porte deux casquettes :

1. **La bibliothèque d'analyse que Modal importe** — `/separate`, `/tempo`,
   `/chords`, `/structure` (PyTorch, BTC, SongFormer, Demucs). Irremplaçable,
   verrouillée par pytest, c'est la mission qui reste.
2. **Un serveur local historique** (pré-D4.b) qui duplique le binaire Rust :

| Doublon | Python | Rust |
| --- | --- | --- |
| Projets (manifeste + audio) | `projects.py`, `stems_store.py` | `project_store.rs`, `audio_store.rs` |
| Import URL (yt-dlp) | `download.py` | `download.rs` + crate `loupe-download` |
| Politique de hosts yt-dlp | `download.py` `_SUPPORTED_HOSTS` | `loupe-download` (3e copie : `packages/core/src/application/supported-source.ts`) |
| Garde réseau | `netguard.py` | `netguard.rs` |
| Allowlist origins | `origins.py` | `config.rs` (3e copie assumée : miroir Deno de l'Edge Function) |
| GC des blobs | `temp_sweep.py` | `/gc` + `fs_atomic.rs` |
| Servir le web | `web_dist.py` | `static_web.rs` |

## S0 — Enquête préalable (OBLIGATOIRE avant de couper)

- [ ] **Cartographier le flux dev réel de la persistance.** Les stores HTTP du
  web parlent à `window.location.origin` (voir
  `packages/web/src/projects/create-project-stores.ts`) : en dev Vite (5173),
  qui répond à `/projects` ? Hypothèses à vérifier : proxy Vite vers 8000 ?
  dev via le binaire (6173) ? persistance simplement absente en dev 5173 ?
  → grep `proxy` dans `packages/web/vite.config.ts`, lire `docs/RELEASING.md`
  et `package.json` (`dev:server`).
- [ ] **Lister qui consomme les endpoints locaux Python** : CI
  (`.github/workflows/ci.yml`), tests pytest de `projects.py`/`download.py`,
  scripts, docs. Rien d'autre ne doit casser.
- [ ] **Vérifier le chemin analyse en dev local** (sans Modal) : le web parle
  à `http://localhost:8000` pour `/tempo` etc. ? (cf.
  `packages/web/src/audio/http/analysis-endpoint.ts`). L'analyse RESTE au
  Python — ne pas la couper, elle.

## S1 — Rétrécir `server/` à la bibliothèque d'analyse

- [ ] Retirer de `server/app/` : `projects.py`, `stems_store.py`,
  `download.py`, `web_dist.py`, `temp_sweep.py` (+ leurs tests) et les routes
  correspondantes de `main.py`/`cli.py`. `netguard.py`/`origins.py` restent
  s'ils protègent les endpoints d'analyse (vérifier qui les importe).
- [ ] La politique de hosts yt-dlp ne vit plus qu'en DEUX endroits : le core
  TS (source de vérité produit) et `loupe-download` — mettre à jour le
  commentaire de parité des deux côtés.
- [ ] `server/README.md` + `README.md` racine : le Python = « la bibliothèque
  Modal + son harnais dev/CI », plus jamais « serveur local ».

## S2 — Le dev s'aligne sur le binaire

- [ ] Si S0 révèle que le dev persistance passait par le Python : documenter
  le flux de remplacement (binaire `loupe` en dev, ou proxy Vite → 6173) dans
  le README et `docs/RELEASING.md` ; ajuster `pnpm dev:server` (le garder
  pour l'analyse seulement, le renommer `dev:analysis` si plus clair).

## S3 — Verrous

- [ ] Un test de parité origins Rust ↔ Deno (le couple restant).
- [ ] `pnpm gate` + pytest CI verts ; `pnpm sonar` lu ; rapport de session +
  STATUS (« serveur unique livré par PR #NN », merge-invariant).

## Ce qui ne bouge PAS

- Le calcul offloadé Modal (ADR 0007) et son gating JWT/quota.
- Le binaire `loupe` (D4.b) et sa chaîne de release (`docs/RELEASING.md`).
- Le miroir Deno des origins (runtime distinct, assumé).
