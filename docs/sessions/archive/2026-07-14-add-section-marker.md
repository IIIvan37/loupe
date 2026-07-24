# Session — 2026-07-14 — « + Section » : marqueur de structure à la main

## Done

- **Demande utilisateur** : « on voit bien les 2 types de marqueurs, mais je
  ne peux pas créer le type que je veux » — la structure ne naissait que de
  la détection ou des `[headers]` tapés. Approche validée (AskUserQuestion) :
  bouton **« + Section »** à côté de « + Repère », et sémantique **écrasable**
  confirmée (la grille fait autorité — en échange, les sections posées à la
  main guident la détection d'accords via le fix #130).
- `useMarkers.addSectionAt(timeSeconds)` : mint un marqueur
  `kind: 'structure'` au playhead, libellé auto « Section N » (N = nombre de
  marqueurs de structure + 1, id Lingui `markers.default-section-name`),
  renommable comme les autres.
- `MarkerControls` : bouton « + Section » (`markers.add-section`), optionnel
  (`onAddSection?`), même recette visuelle/disabled que « + Repère ».
- Shell : câblé sur `markers.addSectionAt(position.get())`.
- **Raccourci clavier `Maj+M`** (retour utilisateur, ajout dans la même PR) :
  commande core `addSectionMarker`. Subtilité : les bindings par caractère
  étaient shift-agnostiques (voulu pour `+`) — le matching devient **shift
  opt-in** : un binding qui DÉCLARE `shift` l'exige, un binding muet reste
  agnostique (Maj+L toggle toujours la boucle, testé). `{key:'m', shift:true}`
  listé AVANT le `m` nu (l'ordre départage). Dispatch web + carte des
  raccourcis auto-dérivée (« ⇧ + M — Ajouter une section »,
  `shortcuts.add-section`).
- Catalogue fr extrait (`i18n:extract`).

## Not done / remaining

- Pas de conversion repère ↔ section dans le popover de renommage (option
  écartée par l'utilisateur au profit du bouton seul ; à ajouter si le besoin
  revient — utile pour « protéger » une section en la dégradant en repère).

## Decisions

- Un marqueur de structure posé à la main est **écrasable** comme les autres
  (re-détection, resync d'édition de grille) — validé explicitement.
- Libellé auto « Section N » : numéroté sur les structure markers existants.

## Gate status

- typecheck : ✅ (`pnpm gate` exit 0 ; fake `Markers` de
  project-session.spec complété avec `addSectionAt`)
- tests (with coverage) : ✅ 1421 tests (+5 : 2 MarkerControls, 1 shell
  bouton, 2 core/shell raccourci Maj+M — dont la garde « binding muet reste
  shift-agnostique »)
- mutation (Stryker, core touché) : **93,49 %** global, **100 % sur
  key-bindings.ts**
- biome / sheriff / knip / jscpd / impeccable / react-doctor : ✅

## State to resume from

- **Single next action** : merger la PR de cette branche
  (`feat/add-section-marker`), puis vérif navigateur pré-démo bout-en-bout
  (The Logical Song, projet ré-ouvert : structure ×2, + Section, accords).
- Gotchas : `onAddSection` est optionnel sur MarkerControls (absent = bouton
  caché) — les vieux call-sites/tests sans le prop restent valides.
