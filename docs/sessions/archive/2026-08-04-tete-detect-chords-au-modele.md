# Session — 2026-08-04 — tête de detect-chords au modèle (PR-3)

Troisième et dernier lot du chantier Texte-comme-modèle
([2026-08-04-form-encoder-au-modele.md](2026-08-04-form-encoder-au-modele.md)) :
plus aucun émetteur n'assemble de texte — `detect-chords` construit UN
`ChordChart` (directives comprises) et un seul `renderChart` imprime le
draft entier.

## Done

- **`respellChart`** (chord-chart.ts, TDD) : le respell au niveau modèle —
  racines et basses slash re-épelées via `respellChordSymbol`, qualités,
  flags, `{time:}` et directives verbatim. Le jumeau modèle de
  `respellChartSource`, pour les charts machine-générés (aucun layout
  utilisateur à préserver) ; le texte utilisateur (transposeChart) garde le
  chemin source.
- **`structuredChart`** remplace `renderStructuredSource` : l'émetteur
  structuré rend un `ChordChart` (sans `barsPerRow` — le layout n'existe
  qu'à l'impression), les appelants (`relabelChartBySections`, fallback du
  form-encoder, detect-chords) impriment via `renderChart`.
- **`encodeChart`** remplace `encodeChartSource` : le rollout devient la
  directive de modèle `{form: Nx}` — exactement ce que `unrollChart` lit,
  l'encodeur écrit ce que le playback consomme. `EncodedChart` supprimé,
  `renderPlan` devient `planChart`, `barsPerRow` sort entièrement de
  l'encodeur.
- **`detect-chords`** : la tête `{key}`/`{time}`/`{form}` est un objet
  `directives` du modèle (ordre d'insertion = contrat de tête), le respell
  passe au modèle, un seul `renderChart` imprime — plus aucune
  concaténation `\n`. **`timeLine` morte** (unique consommateur disparu) ;
  `timeSignature` reste la seule graphie `N/4`.
- **Churn canonique épinglé (3 specs)** : l'air canonique de `renderChart`
  insère une ligne vide entre les directives de tête et un premier header
  `[Section]` (`{time: 4/4}\n\n[Couplet]`) — parse-invariant, cohérent avec
  la règle d'air de PR-1. Les specs form-encoder perdent leurs
  reconstructions `full` à la main : le rendu porte déjà `{form: Nx}`.

## Not done / remaining

- **L'alias `'C G'`** re-parsé par `indexOf(' ')`/`includes(' ')`
  (section-matching.ts `headChord`, bass-line.ts) reste : le courant des
  labels reste des strings par décision (voir Decisions) — ce n'est plus
  une dette du chantier.
- **Retour au labo starter** — l'action « en tout dernier » du backlog
  revue est maintenant atteinte. Candidat : module `playback/` (nursery).

## Decisions

- **Le courant des labels reste des strings.** Le label (`'C G'`) est la
  valeur d'OBSERVATION de la détection — c'est ce que le vote, le
  matching tolérant et le cycle comparent. Convertir voting/matching au
  modèle `Measure` n'a aucun consommateur (invariant 2, outside-in) ;
  l'alias re-parsé aux frontières est l'idiome de la frontière
  détection↔modèle, pas une dette.
- **`{form: Nx}` est du modèle, pas un à-côté du rendu** : l'encodeur pose
  la directive que `unrollChart` lit déjà — le champ `rollout` séparé
  (recollé à la main par l'appelant) disparaît.
- **Les directives sont épelées par leur auteur** : `respellChart` ne
  touche pas `directives` — la tête `{key}` est construite APRÈS le
  respell par `keyName`, qui porte son propre accidental.

## Gate status

- typecheck : ✅ (core + web)
- tests (with coverage) : ✅ 2 549 tests (1 395 core), couverture 91,54 %
  statements — gate stampé `10f675ee`
- mutation (Stryker, local, diff) : ✅ **91,82** (seuil 90). Zéro survivant
  sur `respellChart` et l'assemblage de tête ; survivants des lignes
  touchées audités un par un, tous équivalents par les classes déjà
  auditées en PR-1/PR-2 : gardes de spread (`meterChanges: []` invisible),
  conjoints mutés un à un (`index === undefined - 1` = NaN garde toujours,
  `{fine: undefined}` sauté par `formMarkLines`), seeds jamais imprimés
  (marque à `measure` undefined jamais due), fallback non-structuré =
  raccourci (une instance passe par le DP vers le même chart octet pour
  octet). Le run CI post-merge reste la référence.
- biome / sheriff / knip / jscpd : ✅
- sonar : ✅ PR #366 — quality gate OK, 0 issue, 0 hotspot.

## State to resume from

- **Single next action** : après merge de la PR #366, **retour au labo
  starter** (l'action « en tout dernier » du backlog revue #357).
  Candidat de récolte : module `playback/` (nursery).
- Gotchas :
  - Toute spec texte-exact d'un draft avec sections nommées inclut la
    ligne vide d'air canonique après la tête (`{time: 4/4}\n\n[Couplet]`).
  - L'ordre des directives de tête est l'ordre d'insertion de l'objet
    (`key`, `time`, puis celles de l'encodeur) — c'est le contrat de tête
    du draft.
  - `respellChart` ne respell pas les directives : un appelant qui
    poserait un `{key}` AVANT le respell garderait sa graphie d'origine.
  - Piège Stryker reconduit : ne muter à la main que le span EXACT du
    rapport JSON (Stryker mute les conjoints un par un, jamais la
    condition entière).
