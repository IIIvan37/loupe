# Session — 2026-07-12 — dead-accent-token (O.1)

## Done
- **Fix du token mort** : `tempo-panel.module.css` `.error` référençait
  `var(--accent)` qui n'existe nulle part — le texte d'erreur du tempo
  héritait de la couleur courante au lieu du danger. Remplacé par
  `composes: errorLine from '../ui/controls.module.css'` (même recette que
  chord-chart-panel) ; `margin-left` → `margin-inline-start` au passage.
- **Verrou au gate** : `scripts/check-css-tokens.sh` diffe les tokens
  `var(--…)` utilisés dans les `*.css` de `packages/web/src` contre les
  définitions (custom properties CSS **et** styles inline `'--x': …` posés
  depuis TS/TSX — `--bars-per-row`, `--cluster-gap`, `--stack-gap`). Câblé
  en `check:tokens` dans le pipeline `gate`. Rouge/vert prouvés : le script
  échoue (exit 1, liste `--accent`) sur l'état pré-fix via `git stash`,
  passe après.
- Micro-revue : durci le script (`|| true` sur chaque grep) pour qu'un côté
  vide du diff (zéro match sous `set -e`) ne fasse pas planter le gate.
- N.4 mergée en début de session (PR #105) — rien à reprendre.

## Not done / remaining
- O.2 (micro-dérives design), O.3 (découpe `workstation-shell.spec.tsx`),
  O.4 (`btc_windows.py`), O.5 (basses code groupées) restent ouverts.

## Decisions
- Le check tokens compte les styles inline TS/TSX (`'--x': …`) comme des
  définitions — sinon les vars posées par les layouts Every Layout
  (`--cluster-gap`, `--stack-gap`) et `--bars-per-row` seraient de faux
  positifs.
- `check:tokens` invoqué via `bash scripts/…` (un chemin nu est flaggé
  « unlisted binary » par knip).

## Gate status
- typecheck: ✅
- tests (with coverage): ✅ 1043 tests / 89 fichiers, statements 96,49 %
- mutation (Stryker, local, if core touched): skipped — core intouché
  (CSS web + script shell + package.json)
- biome / sheriff / knip / jscpd: ✅ (gate exit 0, `check:tokens` inclus ;
  seul le durcissement `|| true` du script est postérieur au run complet,
  re-vérifié isolément rouge + vert)

## State to resume from
- **Single next action**: ouvrir la PR O.1, puis attaquer **O.2**
  (transitions hors tokens motion dans analysis-panel + stem-lanes, focus
  ring teal du toast, espacements marker-rail, `--tracking-label`).
- Gotchas / half-done edits: aucun. `your-song-elton-john-chart.pdf` traîne
  non versionné à la racine (référence Lot P, document sous droits — ne pas
  commiter).
