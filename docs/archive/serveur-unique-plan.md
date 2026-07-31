# Plan « serveur unique » — le Python devient la bibliothèque Modal, rien d'autre

> Décidé le 2026-07-31 (session retrait Tauri, PR #327) : les surfaces locales
> dupliquées entre `server/` (Python) et `crates/loupe-server` (Rust) se
> consolident côté Rust — le binaire `loupe` est le seul livrable. **Soldé le
> 2026-07-31** (étape « serveur unique », voir le rapport de session daté) ;
> écarts au plan initial notés en fin de document.

## Constat (inventaire 2026-07-31)

`server/` porte deux casquettes :

1. **La bibliothèque d'analyse que Modal importe** — `/separate`, `/tempo`,
   `/chords`, `/structure` (PyTorch, BTC, SongFormer, Demucs). Irremplaçable,
   verrouillée par pytest, c'est la mission qui reste.
2. **Un serveur local historique** (pré-D4.b) qui duplique le binaire Rust :

| Doublon | Python | Rust |
| --- | --- | --- |
| Projets (manifeste + audio) | `projects.py` | `project_store.rs`, `audio_store.rs` |
| Import URL (yt-dlp) | `download.py` | `download.rs` + crate `loupe-download` |
| Politique de hosts yt-dlp | `download.py` `_SUPPORTED_HOSTS` | `loupe-download` (3e copie : `packages/core/src/application/supported-source.ts`) |
| Garde réseau | `netguard.py` | `netguard.rs` |
| Allowlist origins | `origins.py` | `config.rs` (3e copie assumée : miroir Deno de l'Edge Function) |
| GC des blobs | `temp_sweep.py` | `/gc` + `fs_atomic.rs` |
| Servir le web | `web_dist.py` | `static_web.rs` |

## S0 — Enquête préalable (OBLIGATOIRE avant de couper)

- [x] **Cartographier le flux dev réel de la persistance.** Verdict : en dev
  Vite (5173) la persistance est **simplement absente** — pas de proxy Vite,
  `isServerShell()` faux → stores null-object, UI projets cachée. Rien à
  remplacer.
- [x] **Lister qui consomme les endpoints locaux Python** : personne hors de
  leurs propres tests pytest. Le distributable Python (`cli.py`, wheel,
  `build-server-dist.sh`) n'était référencé nulle part (CI, RELEASING).
- [x] **Vérifier le chemin analyse en dev local** : le web parle à **Modal**
  (`VITE_ANALYSIS_URL`, obligatoire — échec bruyant sinon), jamais à
  `localhost:8000`. Le Python local n'est que le harnais dev/CI de la
  bibliothèque.

## S1 — Rétrécir `server/` à la bibliothèque d'analyse

- [x] Retirés : `projects.py`, `download.py`, `temp_sweep.py`, `web_dist.py`,
  `cli.py` (+ leurs tests), le câblage `main.py`, l'entry point wheel de
  `pyproject.toml`, `scripts/build-server-dist.sh`, yt-dlp des requirements.
  `netguard.py`/`origins.py` restent (gardes du harnais ; Modal importe
  `origins`).
- [x] Politique de hosts yt-dlp en DEUX endroits : core TS (source de vérité)
  et `loupe-download` — commentaires de parité mis à jour des deux côtés.
- [x] `server/README.md` + `README.md` racine : le Python = « la bibliothèque
  Modal + son harnais dev/CI », plus jamais « serveur local ».

## S2 — Le dev s'aligne sur le binaire

- [x] S0 a montré que rien ne passait par le Python en dev : pas de flux de
  remplacement à documenter. `pnpm dev:server` renommé **`pnpm dev:analysis`**
  (il ne sert que l'analyse locale).

## S3 — Verrous

- [x] `docs/origins-parity.spec.ts` : parité des défauts d'origins
  Python ↔ Rust ↔ Deno (extraction des trois littéraux, égalité exigée).
- [x] Gate + pytest verts ; sonar lu ; rapport de session + STATUS.

## Ce qui ne bouge PAS

- Le calcul offloadé Modal (ADR 0007) et son gating JWT/quota.
- Le binaire `loupe` (D4.b) et sa chaîne de release (`docs/RELEASING.md`).
- Le miroir Deno des origins (runtime distinct, assumé).

## Écarts au plan initial (constatés en S0/S1)

- **`stems_store.py` reste** : c'est une dépendance de `separation.py`
  (le stockage des stems du job `/separate`, déployé sur Modal) — le constat
  initial le classait à tort côté « doublon projets ».
- **La parité origins reste à TROIS copies** (Python ↔ Rust ↔ Deno), pas deux :
  `origins.py` survit car Modal l'importe. Le verrou S3 couvre les trois.
- **Le distributable Python entier est tombé** (`cli.py`, entry point wheel,
  `build-server-dist.sh`) — le plan ne listait que les routes.
