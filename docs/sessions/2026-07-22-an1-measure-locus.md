# Session — 2026-07-22 — AN.1 : synchro locus mesure ↔ texte source

## Done

- **Décisions produit en ouverture de session** : AM.3 (confiance visible,
  implémentation complète jetée avant PR) **et** AM.4 (EQ lisible +
  mini-mètres) écartées — **Lot AM clos** (commits doc-only sur main).
  **AN.5 ajouté** à la roadmap : affichage des accords en chiffrage romain
  (`IM7` pour `CM7` en Do majeur), demande utilisateur.
- **Périmètre AN.1 arbitré : « locus seul »** (points 1+2 de l'approche) — le
  champ d'édition inline par mesure (point 3) est différé ; il pourra devenir
  une slice si le besoin se confirme.
- **Core pur `measureSourceSpans(source)`** (chord-chart.ts) : chaque mesure
  écrite → `{ line, start, end }` (offsets absolus, prêts pour
  `setSelectionRange`). Miroir strict de `parseChart`/`parseRow` (mêmes
  `TOKEN`/`DIRECTIVE`/`HEADER`, même merge `xN`, même carry de volta), offsets
  mesurés sur la ligne brute (l'indentation compte). Property fast-check : une
  span par mesure écrite, ordonnées, chaque slice re-parse vers les mêmes
  accords. Stryker a surfacé des mutants survivants dans le walk (carry volta,
  `gridStarted`, sentinelle de fin de ligne) → 3 tests tueurs ajoutés.
- **Web — clic mesure en mode édition = locate** (chord-chart-panel.tsx) :
  éditeur déplié → le tap d'une mesure place le curseur sur ses tokens
  (focus + sélection du span) au lieu de seek — même sans beat grid. Les
  boutons annoncent l'action honnêtement (`chart.measure-locate`, « Placer le
  curseur sur la mesure N » vs `chart.measure-seek`).
- **Web — ligne active surlignée** : le caret du textarea (`onSelect`) dérive
  la ligne source ; les mesures de cette ligne portent `data-active-line`
  (liseré teal). Dérivé de `(editing, caretLine)` — pas de sync d'état
  (react-doctor `no-chain-state-updates` corrigé en dérivation).
- **Revue (3 finders + triage) — 5 corrections appliquées** :
  caret calculé sur la valeur DOM et non la prop `source` (lag d'un
  keystroke) ; `--teal: transparent` dans la stylesheet print (le liseré
  d'édition s'imprimait) ; blur du textarea → locus éteint ; `:where()` pour
  que le liseré amber du playhead batte le teal sur une mesure « les deux » ;
  spec shell « inert sans grille » devenue vide re-durcie (replie l'éditeur,
  vérifie l'absence des DEUX libellés).

## Not done / remaining

- Édition structurée mesure-par-mesure (champ inline réécrivant le span) —
  différée par l'arbitrage de périmètre.
- Trade UX assumé : éditeur ouvert = pas de tap-to-seek (le tap locate), et
  chaque locate rend le focus au textarea (clavier levé au toucher). À
  confirmer à l'usage.
- Altitude : `rowMeasureSpans` duplique le state-machine de `parseRow` (le
  carry volta verbatim). L'idiome anti-dérive du fichier (grammaire partagée +
  property re-parse + tests tueurs) couvre ; si une 3e copie apparaît, rendre
  `parseRow` span-aware.
- À l'ouverture de l'éditeur, le focus place le caret en fin de source → la
  dernière ligne s'allume immédiatement (le caret y est réellement) — accepté.

## Decisions

- **Lot AM clos par élagage** : AM.3/AM.4 écartées (faible valeur pour un
  outil de pratique) — la roadmap v7 porte la trace.
- **AN.5 (chiffrage romain) ajouté** au Lot AN — transform pur côté core
  (label seulement, la source reste en lettres), bascule UI.
- **AN.1 = locus seul** ; en mode édition le clic mesure change de sémantique
  (locate, jamais seek) — le libellé AT suit.
- Le locus est une **affordance écran** : neutralisé à l'impression comme le
  wash amber du playhead (`--teal: transparent` dans le bloc print).

## Gate status

- typecheck : ✅
- tests (with coverage) : ✅ 1995 tests, 153 fichiers (coverage web/core dans
  les seuils)
- mutation (Stryker, local, `--force --mutate chord-chart.ts`) : ✅ 95,31 %
  → **96,39 %** après deux vagues de tests tueurs (carry volta, arrêt du
  carry au `:|`, `gridStarted`, header indenté, cellule finale sans barre) +
  restructuration de la garde `first`/`last`. Les 6 survivants restants du
  nouveau code sont des mutants équivalents (garde couplée `first`/`last`,
  forme de `previous` sans effet sur le merge, skip de ligne blanche) ; break
  global 90 tenu.
- biome / sheriff / impeccable / react-doctor / knip / jscpd : ✅ (react-doctor
  a exigé la dérivation du surlignage — corrigé)

## State to resume from

- **Single next action** : ouvrir la PR de `feat/an1-measure-locus` (rapport
  inclus), puis après merge : STATUS/roadmap sur main (doc-only) et attaquer
  **AN.2 — grammaire qui ne ment plus** (retour de parse, tokens non
  ré-imprimables signalés).
- Gotchas : `measureSourceSpans` doit rester le miroir de `parseChart` — toute
  évolution de la grammaire (nouvelle règle de cellule dans `parseRow`) doit
  toucher les deux walks ET enrichir le corpus du property test ; les specs du
  panel supposent le commit synchrone de `onSourceChange` (le caret est lu sur
  la valeur DOM, déjà robuste au cas débounce).
