# Session — 2026-07-31 — serveur unique (le Python devient la bibliothèque Modal)

## Done

- **S0 (enquête, obligatoire avant de couper)** — verdicts :
  - dev Vite 5173 : la persistance est **simplement absente** (pas de proxy,
    `isServerShell()` faux → stores null-object) — rien à remplacer ;
  - l'analyse web parle à **Modal** (`VITE_ANALYSIS_URL`, échec bruyant si
    absent), jamais à `localhost:8000` ;
  - le distributable Python (`cli.py`, entry point wheel,
    `build-server-dist.sh`) n'était référencé **nulle part** (CI, RELEASING) ;
  - **correction au plan** : `stems_store.py` est une dépendance de
    `separation.py` (déployée sur Modal) — il reste.
- **S1 — `server/` rétréci à la bibliothèque d'analyse** : retirés
  `projects.py`, `download.py`, `temp_sweep.py`, `web_dist.py`, `cli.py`
  (+ leurs 8 fichiers de tests), le câblage `main.py` (GC boot, mount
  statique, fallback download), `read_capped_json`/caps manifeste+store de
  `limits.py`, l'entry wheel de `pyproject.toml`, `build-server-dist.sh`,
  yt-dlp des deux requirements. `netguard.py`/`origins.py` restent (gardes du
  harnais ; Modal importe `origins`). Exemption Sonar fp5 (projects.py) retirée.
- **Parité hosts yt-dlp à DEUX copies** : core TS (source de vérité) ↔
  `loupe-download` ; commentaires croisés mis à jour (celui du core pointait
  encore `packages/desktop`, retiré en #327).
- **S2 — docs** : `server/README.md` réécrit (« la bibliothèque d'analyse que
  Modal importe + son harnais dev/CI », contrat HTTP réduit aux analyses,
  ligne `/structure` ajoutée), README racine aligné, `pnpm dev:server` renommé
  **`pnpm dev:analysis`**. Commentaires Rust/web dépoussiérés (plus aucune
  référence aux .py disparus ni à Tauri) ; 2 exclusions coverage périmées
  retirées de `vitest.config.ts` (`tauri-fs`, `tauri-download-bridge`).
- **S3 — verrou** : `docs/origins-parity.spec.ts` — parité des défauts
  d'origins **Python ↔ Rust ↔ Deno** (extraction des trois littéraux, égalité
  exigée ; à trois car `origins.py` survit pour Modal). Les trois sites
  pointent vers le verrou ; commentaire Deno périmé (origines Tauri) corrigé.
- Plan soldé et archivé : `docs/archive/serveur-unique-plan.md` (écarts au
  plan initial documentés en fin de fichier). PR #328 ouverte.

## Not done / remaining

- **Action opérateur** (héritée de #327) : redeploy Modal + Edge Function pour
  le défaut d'origins sans `tauri://`.
- Garde-fous beta ([beta-checklist.md](../beta-checklist.md)) et 1re release
  taguée — prochaines étapes candidates.

## Decisions

- Le harnais local d'analyse (uvicorn 8000) reste **sans gating JWT** : les
  gardes loopback/Origin/Host suffisent pour un process de dev ; le gating
  (`analyze_gate`) reste un montage Modal (`modal_app.py`).
- Pas d'ADR : c'est l'exécution du cap distribution (D1–D6 + #327), le plan
  archivé + ce rapport portent le détail.

## Gate status

- `pnpm gate` ✅ complet (tampon `17109290`) : typecheck ✅ · biome ✅ ·
  sheriff ✅ · design/react ✅ · tokens/i18n ✅ · tests+coverage ✅ (91,15 %
  statements, verrou origins inclus) · knip ✅ · jscpd ✅.
- pytest serveur : ✅ 178 tests, couverture 98,5 % (plancher 80) ; ruff +
  format + pyright ✅. `cargo test -p loupe-server -p loupe-download` ✅ (21).
  `deno fmt --check` + `deno check` ✅ sur l'Edge Function.
- mutation (diff) : ✅ 92,01 % ≥ seuil 90 (seul `supported-source.ts` touché
  côté core, en commentaire — le run couvre le module).
- sonar : analyse de la PR #328 à relire avant merge (`pnpm sonar 328`).

## State to resume from

- **Single next action** : relire `pnpm sonar 328`, merger la PR #328, puis
  choisir : garde-fous beta ([beta-checklist.md](../beta-checklist.md)) ou 1re
  release taguée (`docs/RELEASING.md`).
- Gotchas :
  - `server/` n'a plus d'entry point wheel : `pyproject.toml` ne contient QUE
    de la config d'outils — ne pas y remettre de `[project]` sans raison.
  - Le verrou `docs/origins-parity.spec.ts` extrait les littéraux par regex :
    si un des trois fichiers reformate sa constante, adapter la regex (le
    verrou échoue bruyamment, il ne passe pas en silence).
