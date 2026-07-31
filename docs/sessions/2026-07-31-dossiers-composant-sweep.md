# Session — 2026-07-31 — balayage dossiers-composant sur tout l'arbre (ADR 0013 soldé)

## Done

- **Les 25 composants à compagnons restants en dossier-composant** (branche
  `refactor/dossiers-composant-sweep`, stackée sur #325, PR ouverte) :
  account (menu, slot, gate-notice), analyser-row, chroma-view, import-menu,
  shortcuts-dialog, loops (loop-controls, speed-trainer-controls), markers
  (marker-controls, marker-rail), mixer (stem-headers, stem-lanes,
  undetected-stems), tempo-panel, waveform (viewport-controls, waveform-view,
  zoom-stage), projects-dialog, et les 6 régions shell — **67 fichiers
  déplacés**, move-map générée par script, imports réécrits par codemod.
- La convention est désormais uniforme : un `.tsx` à compagnons vit dans son
  dossier, partout.
- Périphérie : `dense-rows-wrap.spec` (tempo-panel), composes
  `hover-cursor` passé en `@/`, catalogue Lingui.

## Not done / remaining

- **Cliquet `folder-shape` reste à 11** — assumé : les deux dossiers au
  plafond (`lib`, `workstation-shell/lifecycle`) sont des dossiers de rôle
  en hooks/utilitaires, pas des composants ; les sous-découper serait du
  rangement par type technique (contre la règle 1). Descendre sous 11
  demanderait une vraie décision de découpe, pas ce balayage.
- Le chantier ADR 0013 est **soldé** : rôles, dossiers-composant partout,
  `foreign-css` 0, `composes` via `@/`, deux cliquets en garde.

## Decisions

- Un dossier de feature homonyme de son composant (`header/header.tsx`,
  `transport-bar/transport-bar.tsx`) EST le dossier-composant — pas de
  sous-dossier redondant.

## Gate status

- `pnpm gate` ✅ complet (tampon `1b7809fe`) : typecheck ✅ · biome ✅ ·
  sheriff ✅ · design/react ✅ · tokens/i18n ✅ · knip ✅ · jscpd ✅.
- tests : ✅ suite verte (1158). `pnpm --filter @app/web build` ✅.
- mutation : **sans objet** — aucune source core touchée.
- sonar : #325 relu **propre** (0 issue) ; l'analyse de cette PR à relire
  avant merge.

## State to resume from

- **Single next action** : retour au cap — garde-fous beta
  ([beta-checklist.md](../beta-checklist.md)) ou 1re release taguée
  ([distribution-plan.md](../distribution-plan.md)).
- Gotchas : inchangés (build vite après déplacement CSS ; chemins en dur de
  `dense-rows-wrap.spec` et des docs vivants).
