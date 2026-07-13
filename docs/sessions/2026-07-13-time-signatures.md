# Session — 2026-07-13 — time-signatures (pré-démo #3)

## Done
- **`{time: N/M}` — notation standard (ChordPro) des signatures rythmiques.**
  En tête de source = directive (signature du chart, remplace le `/4` codé en
  dur de `chart-header`) ; pleine-ligne mid-grid = changement de mètre
  (`chart.meterChanges`, position en mesures écrites comme les form marks),
  rendu en petit signe dans la mesure qui l'ouvre, intact sous
  transpose/respell. Le mark ride la MÊME grammaire `DIRECTIVE` que la tête
  (seul le payload `N/M` lui est propre).
- **La détection écrit le mètre.** `chartMeters(grid, beatsPerBar?)` : comptes
  par intervalle downbeat→downbeat (`meterPerMeasure`), dominant voté sur les
  mesures COMPLÈTES (même électorat que `detectMeter` — le panneau et le chart
  ne peuvent pas se contredire), `beatsPerBar` de session en **autorité**
  (un fold d'octave double la densité, pas le mètre ressenti — rescale, un
  compte non-entier est du bruit), mesures de BORD distrusted hors dominant
  (1re = anacrouse, dernière = troncature — et le rendu ne peut jamais ouvrir
  sur une ligne `{time:}` nue que `parseChart` avalerait en zone directive
  par-dessus la tête `{time: dominant/4}`). Les mètres votent par section comme
  les accords (`deduceStructure(labels, meters)`), le relabel structure (S.3b)
  ré-émet les changements.
- **Fold `|: :|` méter-aware** : une paire ne se replie que si les DEUX passes
  rendent identique (des barres de reprise ne re-déclarent pas un mètre) ; une
  section qui finit hors de son mètre d'ouverture s'écrit en copies, chaque
  copie re-déclarant son entrée (`segmentRows` unique, memoizé par mètre
  d'entrée).
- **`detectMeter` = mètre DOMINANT** des mesures complètes (délègue à
  `meterPerMeasure(buildBeatGrid(…))`) — une position parasite ne promeut plus
  un morceau en 6 temps (le cas Logical Song signalé par l'utilisateur) ; repli
  sur le max de position avant une première mesure complète.
- **Correction utilisateur du mètre** : le « N temps » du panneau tempo devient
  un champ numérique (`CommitNumberField` extrait, partagé avec le champ BPM ;
  min 1, max `MAX_BEATS_PER_BAR` = 12). `overrideMeter` → `remeterGrid` pur
  (re-flag des downbeats tous les N sur la phase du 1er downbeat, instants
  gardés, anacrouse préservée), click re-seaté, détection en vol supersédée,
  erreur périmée effacée. **Re-committer le même mètre régularise** une grille
  au dominant juste mais aux mesures bruitées (pas un no-op silencieux).
- **Persistance + signature** : `beatsPerBar` signé (stand-in du mètre) ET le
  **pattern de downbeats** signé (indices sur grille `sanitizeBeatGrid`-isée
  des deux côtés — une correction qui retombe sur le même `beatsPerBar` reste
  un edit non enregistré ; vieux manifests signent égal). Round-trip shell
  vérifié : 6 temps détecté → corrigé à 4 → save → reopen sans re-détection.
- **Revue 8 angles** (A/B/C + reuse/simplification/efficiency/altitude/
  conventions, agents parallèles) : 3 bugs confirmés fixés (collision
  double-tête `{time:}`, fold perdant la re-déclaration en 2e passe, densité
  post-fold imprimée comme mètre), 2 comportements (garde même-valeur,
  `setError`), + cleanups (fixture `meteredGrid` partagée entre 3 specs,
  `timeLine` unique, `votedBlock` générique sans casts, `meterAt` construit
  dans le memo `[source]`, câblage chart+structure extrait en
  `useChartWithStructure` — shell < 300 lignes).

## Not done / remaining
- **Chart périmé après correction de mètre** (constat de revue, assumé) : un
  chart détecté sous la mauvaise grille garde ses mesures ET sa directive
  `{time:}` de tête après la correction — l'en-tête imprimé peut dire 6/4
  jusqu'à re-détection. Le flux prévu : corriger le mètre PUIS relancer
  « Détecter les accords » (confirmation deux-temps déjà en place). Un hint de
  divergence type N.3 est envisageable si ça mord en usage.
- Dénominateur toujours `/4` à l'émission (`timeLine`) — `parseChart` accepte
  n'importe quel `N/M` (un `{time: 6/8}` manuel s'affiche), mais rien ne
  l'interprète en aval. Modèle `{beats, unit}` différé.
- Mesure multi-accords auto : toujours différé (pré-démo).
- Retrofit `/tempo` sur `classifyTransportError` : toujours noté.

## Decisions
- **Notation standard** : `{time: N/M}` (ChordPro), pleine-ligne mid-grid pour
  les changements — demandé explicitement par l'utilisateur (« il doit exister
  une notation standard pour ça »).
- **Le `beatsPerBar` de session est l'autorité du mètre imprimé** ; la densité
  de la grille n'est qu'un témoin (fold-proof).
- **Mesures de bord jamais marquées hors dominant** (anacrouse/troncature) —
  c'est aussi ce qui rend la collision de tête impossible par construction.
- **Anacrouse** : les temps avant le 1er downbeat restent une levée
  (`remeterGrid` ne crée pas de downbeat rétroactif).
- **Un mètre re-committé régularise** — un edit explicite est une autorité,
  comme le champ BPM.

## Gate status
- typecheck: vert
- tests (with coverage): vert — **1401 tests** (+61 depuis PR #128)
- mutation (Stryker, local, core touché): **93,5 %** (post-fixes de revue ;
  93,8 % avant — tempo.ts 94,4, chord-chart 96,5, chart-structure ~92)
- biome / sheriff / knip / jscpd / impeccable / react-doctor: verts (8 clones
  jscpd = seuil existant)

## State to resume from
- **Single next action** : ouvrir la PR de `feat/time-signatures` (rapport
  inclus), merger, puis **vérif navigateur sur The Logical Song** (racine du
  repo) : détection tempo → mètre affiché → correction éventuelle → détection
  accords → `{time:}` en tête + 2/4 marqués — le vrai test pré-démo.
- Gotchas : la vérif navigateur exige le serveur local ET le port 5173 ;
  `meteredGrid` fixture partagée vit dans
  `packages/core/src/domain/metered-grid-fixture.ts` (non-spec, couverte par
  les specs) ; `useChartWithStructure` porte désormais le câblage
  chart↔structure du shell.
