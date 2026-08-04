# Session — 2026-08-04 — émetteurs structurés au modèle (PR-1)

Premier lot de la suite consignée par
[2026-08-04-render-chart.md](2026-08-04-render-chart.md) : le chemin
`chart-structure` n'assemble plus de texte — il construit un modèle
`ChordChart` et `renderChart` imprime.

## Done

- **`measureOfLabel`** (chord-chart.ts, TDD) : la conversion label→`Measure`
  unique — même garde que `cellToken` (label imprimable → accords, sinon un
  `N.C.`), le jumeau modèle de la cellule.
- **`renderChartSource` projeté sur `renderChart`** : l'imprimeur de labels
  perd sa boucle de rangées (une copie de la grammaire en moins). Nuance de
  contrat documentée : une graphie imprimable mais non re-imprimable se
  normalise en ce que `parseChart` lit de toute façon (`C/E/G` imprime
  `C/E`) — les labels de production sortent déjà de `formatChordSymbol`,
  zéro spec touchée.
- **Air canonique de `renderChart`** : ligne vide avant un header qui
  n'ouvre pas le rendu, et une marque due à une frontière de section
  s'attache au header qu'elle ouvre (`…\n\n{time: 3/4}\n[B]`) — la forme
  `\n\n` des émetteurs, parse-invariante (le round-trip ignore les lignes
  vides).
- **`renderStructuredSource` au modèle** : les passes deviennent
  `Measure[]` + `MeterChange[]` via `segmentMeasures` (jumeau modèle de
  `segmentRows`, qui devient sa projection texte pour le form-encoder) ;
  le fold de paire `|: :|` = deux flags de modèle, sa légalité = l'égalité
  des séquences de changements (l'équivalent exact de la comparaison de
  texte d'hier) ; `withRepeatBars` sort de ce chemin. `timeSignature`
  rejoint `timeLine` : la notation `N/4` garde une source unique.
- **Zéro churn** : 136 specs structure et 1 391 tests core inchangés — le
  rendu par modèle reproduit le texte octet pour octet.
- Deux mutants tuables trouvés à l'audit et tués (kills vérifiés par
  mutation manuelle) : le fold d'une paire dont le changement de mesure ne
  revient pas (épinglé par un commentaire, pas un test), et le lead
  `{time: undefined/4}` d'une section sans meters.

## Not done / remaining

- **PR-2 — le form-encoder au modèle** : `foldBlock`/`voltaBlock`/
  `renderPlan` assemblent toujours du texte (`withRepeatBars`,
  `body.slice(0, -2)`, `row.replace('| ', '|N. ')`) ; la cible est
  `RenderedBlock` portant des fragments de modèle et un seul `renderChart`
  final. Attendu : churn de specs texte-exact (les endings volta
  fusionneront en une rangée `|1. … :|2. … |`, `{fine}` passera au-dessus
  du header suivant).
- **PR-3 — la tête de `detect-chords`** en directives de modèle
  (`{key}`/`{time}`/`{form}` via `renderChart`), et possiblement le
  respell au niveau modèle pour le draft (machine-généré, pas de layout
  utilisateur à préserver).
- L'alias `'C G'` re-parsé par `indexOf(' ')`/`includes(' ')`
  (section-matching.ts:108, bass-line.ts:176) — à absorber quand le
  courant des labels passera au modèle (PR-2/3).
- Nuance canonique assumée : les copies écrites d'un run s'enchaînent en
  rangées continues (le modèle ne porte pas les retours de ligne par
  copie) — sans effet en pratique, les sections déduites font 4/8/12/16
  mesures.

## Decisions

- **La légalité d'un fold est une propriété de modèle** : « les barres de
  reprise ne peuvent pas re-déclarer une mesure » se vérifie en comparant
  les séquences de `MeterChange` des deux passes — plus jamais en
  comparant du texte rendu.
- **L'air est de l'impression canonique, pas du modèle** : `renderChart`
  décide seul des lignes vides ; le round-trip `parse ∘ render = id` reste
  la seule vérité.

## Gate status

- typecheck : ✅ (core + web)
- tests (with coverage) : ✅ 2 526 tests, couverture ~91,5 % — gate stampé
  `71c56932` (avant les 2 tests tueurs, replay au pre-commit)
- mutation (Stryker, local, diff) : ✅ **91,36** (seuil 90) ; survivants du
  code nouveau audités : tous équivalents par invariant (longueurs égales
  ⟹ contenus égaux pour deux passes des mêmes meters, gardes de spread,
  seeds jamais imprimés, `copy === 0` pur). Le run CI post-merge reste la
  référence.
- biome / sheriff / knip / jscpd : ✅
- sonar : PR #364 — verdict à consigner après la passe CI (commit dédié
  sur la branche).

## State to resume from

- **Single next action** : après merge de la PR #364, au choix de
  l'opérateur — **PR-2 (form-encoder au modèle)** pour finir le chantier
  Texte-comme-modèle, ou **retour au labo starter** (l'action « en tout
  dernier » du backlog revue, déjà atteinte).
- Gotchas :
  - `segmentRows` reste exporté comme projection texte de
    `segmentMeasures` — c'est la couture avec le form-encoder ; PR-2 le
    fera disparaître.
  - Le garde de `measureOfLabel` est `cellToken` : en toucher un, c'est
    toucher les deux (même N.C., même liste de tokens).
  - Piège Stryker reconduit : ne muter à la main que le span EXACT du
    rapport JSON (Stryker mute les conjoints un par un, jamais la
    condition entière).
