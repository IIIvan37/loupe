# Session — 2026-07-15 — t3-navigable-chart

## Done

- **T.3 — Chart navigable : clic-mesure → seek** (branche
  `feat/t3-navigable-chart`, PR à ouvrir). La sync chart↔lecture devient
  bidirectionnelle (standard iReal/Chordify), approche validée au checkpoint.
  - **Core pur `measureSeekTime(source, grid, writtenIndex, playheadSeconds)`**
    (`domain/chart-structure.ts`, TDD) : projection inverse écrit→joué via
    `unrollChart` — l'occurrence choisie est celle **encore devant la tête de
    lecture** (la passe en cours se relance, sinon la prochaine), repli sur la
    première occurrence quand tout est passé ; occurrences hors grille
    ignorées ; `undefined` sans grille ou pour une mesure jamais jouée.
    Property test fast-check du round-trip : l'instant rendu se reprojette
    (`measureIndexAt` + unroll) sur la mesure cliquée, quel que soit le
    playhead.
  - **UI** : les mesures de la `LeadSheet` deviennent des `<button>`
    (`MeasureBox`, aria-label Lingui `chart.measure-seek` « Aller à la mesure
    {number} », nom accessible explicite) **seulement quand un handler
    existe** — sans grille les mesures restent des `<div>` inertes (pas
    d'affordance mensongère, thème T.6). Même peau : reset du skin UA bouton
    dans `.measure`, barres de mesure/reprises intactes. Le scroll
    follow-playhead garde sa ref (élargie à `HTMLElement`).
  - **Wiring** : `onSelectMeasure` remonte `ChordChartPanel` → `ShellMain`,
    qui projette via `measureSeekTime` (source de la session, grille,
    `position.get()`) et seek au downbeat.
- Tests : 6 exemples + 1 propriété core ; vue (index écrit au clic à travers
  les sections, aucune fausse affordance sans handler) ; shell (clic mesure 3
  → seek 8 s **sur le moteur de stems** — la détection résolue charge le
  métronome ; cellules inertes sans grille).

## Not done / remaining

- Lot T restant : T.4 (Cmd+S), T.5 (champs BPM/mètre standard N.4),
  T.6 (découvrabilité), T.7 (fine-tune ±50 cents), T.8 (décisions produit).
  Le séquencement STATUS passe à **V.1** après T.3.

## Decisions

- **Occurrence choisie = la passe en cours ou la prochaine** (fin d'occurrence
  > playhead), repli première occurrence — cliquer la mesure en cours la
  relance au lieu de sauter à la passe suivante.
- **Pas de grille → pas de bouton** : l'affordance n'existe que si le seek
  peut répondre (plutôt qu'un bouton inerte).

## Gate status

- typecheck : ✅ (gate complète)
- tests (with coverage) : ✅ **1507 tests** (+11)
- mutation (Stryker, local, core touché) : ✅ **93,95 %** (break 90). Dans le
  périmètre T.3 (`measureSeekTime`), 2 survivants au premier run : le
  frontière `>`/`>=` sur la fin d'occurrence — tué par le test « une passe
  finissant exactement sur le playhead est derrière » — et un mutant
  **équivalent** (le ternaire `chosen === undefined` : `downbeats[undefined]`
  vaut déjà `undefined`), documenté. Les ~40 autres survivants du fichier
  sont la dette antérieure de chart-structure (hors périmètre).
- biome / sheriff / knip / jscpd / react-doctor / impeccable : ✅

## State to resume from

- **Single next action** : ouvrir la PR de `feat/t3-navigable-chart`, la faire
  merger — **lot T (T.1–T.3) clos** côté séquencement v4 ; ensuite **V.1**.
- Gotchas : avec une détection de tempo résolue, seek et position passent par
  le **moteur de stems** (métronome chargé) — les assertions shell visent
  `stemEngine.seekTo`, pas `engine.seekTo`. Le placeholder ICU d'un message
  Lingui doit être un identifiant simple (`number`), d'où le calcul du label
  dans `MeasureBox`.
