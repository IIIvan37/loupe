# Session — 2026-08-04 — form-encoder au modèle (PR-2)

Deuxième lot du chantier Texte-comme-modèle
([2026-08-04-emetteurs-au-modele.md](2026-08-04-emetteurs-au-modele.md)) :
l'encodeur de forme n'assemble plus de texte — chaque mouvement du plan
produit un fragment de modèle et un seul `renderChart` imprime.

## Done

- **`RenderedBlock` porte du modèle** : `Measure[]` (flags de reprise/volta)
  + `MeterChange[]` locaux au bloc, plus de champ `text` ni `written` (le
  coût DP lit `measures.length` — identique par construction : un fold
  compte son corps une fois, un volta corps + endings).
- **`foldBlock`** : le fold = `repeatStart`/`repeatEnd` (+ `repeatCount`
  au-delà d'une paire) sur les mesures d'UNE passe ; sa légalité =
  `sameChanges(première, seconde)` — la propriété de modèle partagée avec
  `runBlock` (chart-structure), exportée.
- **`voltaBlock`** : corps ouvert par `repeatStart`, chaque ending porte
  son numéro de `volta`, chaque ending non final ferme par `repeatEnd` —
  plus de `body.slice(0, -2)` ni de `row.replace('| ', '|N. ')`.
- **`renderPlan`** : assemble UN `ChordChart` — leads et changes de bloc
  offsetés en `MeterChange` globaux, headers quand plusieurs blocs,
  fine/d.c. en `ChartForm` — et `renderChart` imprime. `planner`/`movesAt`
  perdent `barsPerRow` (le layout n'entre plus dans le plan).
- **Morts** : `withRepeatBars` et `segmentRows` supprimés de
  chart-structure (le form-encoder était leur seul consommateur) ;
  `segmentMeasures` exporté (l'unique walk labels→modèle des émetteurs
  structurés), le walk du rollout l'utilise (plus de rendu texte pour
  vérifier le retour du meter).
- **Churn canonique épinglé (6 specs)** : les endings volta fusionnent
  dans les rangées canoniques (`| Em | Am |1. Dm | G7 :|`), un compte de
  passes imprime `:| xN |` (barre finale de `renderRow`), `{fine}` passe
  au-dessus du header que la frontière ouvre (`…\n\n{fine}\n[B]`). Les
  properties (oracle unroll, stabilité de ré-encodage, bruit) inchangées —
  le playback reste exact.

## Not done / remaining

- **PR-3 — la tête de `detect-chords`** en directives de modèle
  (`{key}`/`{time}`/`{form}` via `renderChart`), et possiblement le
  respell au niveau modèle pour le draft. `timeLine` garde `detect-chords`
  comme unique consommateur — il meurt probablement avec PR-3.
- L'alias `'C G'` re-parsé par `indexOf(' ')`/`includes(' ')`
  (section-matching.ts:108, bass-line.ts:176) — à absorber quand le
  courant des labels passera au modèle (PR-3).
- Nuance reconduite : un ending plus long que `barsPerRow` se casserait en
  plusieurs rangées re-numérotées `|N.` (parse-équivalent) — sans effet en
  pratique, les endings font ≤ `TAIL_LENGTH` = 2 mesures.

## Decisions

- **Le layout n'entre pas dans le plan** : le DP coûte des mesures écrites
  et de la navigation ; `barsPerRow` n'apparaît qu'à l'impression finale.
  Un bloc du plan est un fragment de modèle, jamais du texte.
- **La forme (fine/d.c.) est du modèle, pas de l'assemblage** : renderPlan
  pose `ChartForm` et laisse `renderChart` décider de l'ordre d'impression
  des marques — d'où le déplacement canonique de `{fine}`.

## Gate status

- typecheck : ✅ (core + web)
- tests (with coverage) : ✅ 2 526 tests (1 393 core), couverture 91,53 %
  statements — gate stampé `402419f1`
- mutation (Stryker, local, diff) : ✅ **91,25** (seuil 90). Survivants du
  code nouveau audités un par un, tous équivalents par invariant :
  seeds de tableaux jamais imprimés (une marque à `measure` NaN/undefined
  n'est jamais due), conjoints mutés un à un (`{fine: undefined}` sauté
  par `formMarkLines`, `meterChanges: []` invisible, `opening` undefined ⟹
  `lead` undefined dans les deux versions), gardes défensifs prouvés
  inatteignables (blocs de `tile()` non vides ; `split ≥ tailStart ≥ 2`
  pour toute section pliable, `TAIL_LENGTH` = 2), longueurs égales dans un
  type (`matchesTolerantly` refuse les longueurs inégales). Le run CI
  post-merge reste la référence.
- biome / sheriff / knip / jscpd : ✅
- sonar : ✅ PR #365 — quality gate OK, 0 issue, 0 hotspot.

## State to resume from

- **Single next action** : après merge de la PR de ce lot, **PR-3 (tête de
  `detect-chords` au modèle)** pour clore le chantier Texte-comme-modèle,
  puis **retour au labo starter** (l'action « en tout dernier » du backlog
  revue).
- Gotchas :
  - `sameChanges` et `segmentMeasures` sont maintenant la couture
    chart-structure ↔ form-encoder : en toucher un, c'est toucher les deux
    chemins (runBlock ET foldBlock/writeBlock).
  - Piège Stryker reconduit : ne muter à la main que le span EXACT du
    rapport JSON (Stryker mute les conjoints un par un, jamais la
    condition entière).
  - `renderRow` imprime `:| xN |` (barre finale) — toute spec texte-exact
    d'un compte de passes doit l'inclure.
