# Session — 2026-08-04 — renderChart inverse de parseChart

Priorité 4 (dernière) du backlog de la revue justesse design
([2026-08-03-revue-justesse-design.md](2026-08-03-revue-justesse-design.md),
section Texte-comme-modèle : « parseChart n'a pas d'inverse », « la même
grammaire de ligne est implémentée trois fois à la main »).

## Done

- **`renderChart(chart, barsPerRow = 4)`** (chord-chart.ts) : l'imprimeur
  canonique du modèle `ChordChart` — directives de tête, headers de section,
  rangées à `barsPerRow` mesures, barres de reprise `|:`/`:|`, comptes
  `:| xN`, voltas (numéro soudé à la barre, émis à l'ouverture du groupe),
  fermatas `@` sur le dernier accord, marques `{d.c.}`/`{coda}`/`{fine}` et
  `{time: N/M}` à leur mesure écrite. Deux règles de cassure de rangée :
  une marque due entre deux rangées, et un groupe volta qui se termine sans
  `:|` (le carry de `parseRow` est par ligne — imprimées sur la même ligne,
  les mesures suivantes seraient relues dans l'ending).
- **Contrat property fast-check** : `parse ∘ render = id` sur le modèle, à
  toute largeur de rangée — l'arbitraire couvre le domaine ATTEIGNABLE par le
  parseur (≥ 1 accord par mesure, `xN` sur `:|` nu seulement, seule la
  première section peut être anonyme) ; stressé à 2 000 tirages en local.
  Développé en 13 micro-cycles TDD (fake → triangulation par construct →
  property en clef de voûte).
- **Un seul walk positionnel** : `parseRow`, `measureSites` et
  `rowMeasureSites` fusionnent en `scanChart`/`scanRow` — modèle et positions
  sortent de la même passe, le miroir « Mirrors parseChart's line dispatch
  statement for statement » disparaît ; `chartDiagnostics` ne re-parse plus
  la source (une passe au lieu de deux).
- **La tête du relabel** (`relabelChartBySections`) imprimée par
  `renderChart({ sections: [], directives })` au lieu du template inline —
  une occurrence de la grammaire directive en moins dans `chart-structure.ts`.
- **Mutation** : trois mutants du renderer invisibles au niveau modèle tués
  au texte exact (rangée cassée à la mauvaise marque, numéro de volta
  ré-émis, cassure après un `:|` déjà fermant) + le mutant « garder {time} »
  du filtre de tête du relabel. Chaque kill vérifié par mutation manuelle.

## Not done / remaining

- **Migration des émetteurs `structure/`** (le vrai lot suivant de
  Texte-comme-modèle) : le form-encoder fait toujours de la chirurgie de
  texte — `withRepeatBars` (splice `|: … :|` sur chaîne),
  `voltaBlock` (`body.slice(0, -2)`, `row.replace('| ', '|N. ')`),
  `renderPlan`/`segmentRows`/`renderStructuredSource` assemblent des blocs
  texte. La cible : les blocs construisent des fragments de MODÈLE (mesures
  avec flags, meterChanges locaux) et un seul `renderChart` imprime. Churn
  attendu sur les specs texte-exact du form-encoder → PR dédiée.
  `detect-chords.ts` assemble aussi sa tête à la main (mais via `timeLine`,
  source unique de la notation) — même périmètre.
- L'alias cellule `'C G'` re-parsé par `indexOf(' ')`/`includes(' ')`
  (section-matching.ts:108, bass-line.ts:176) — à absorber par le même lot
  (conversion label↔Measure unique à côté de `cellToken`).
- `renderChartSource` (imprimeur de labels) reste distinct : le rebaser sur
  `renderChart` changerait son contrat « label imprimable verbatim »
  (`'C/E/G'` passe tel quel aujourd'hui, deviendrait `'C/E'` via le modèle).
  À trancher au lot émetteurs.

## Decisions

- **Le contrat définitif remplace les ratchets d'attente** : la revue
  proposait un compte épinglé des fonctions `source: string` et une liste
  fermée des fichiers grammaire « en attendant le refactor renderChart ».
  Le refactor étant livré avec la property `parse ∘ render = id`, ces
  ratchets ne sont pas posés — le lot émetteurs décidera s'il en reste un
  besoin une fois `withRepeatBars` mort.
- **`rewriteChordTokens` garde son propre dispatch** : sa divergence avec le
  parseur (prose `{…}` protégée partout, pas seulement en tête) est un
  comportement voulu du réécrivain (une directive mi-grille ne doit jamais
  voir ses tokens réécrits) — pas une copie de la grammaire à unifier.
- **`renderChart` n'est pas exporté d'`index.ts`** : ses consommateurs de
  production sont intra-core (chart-structure) ; la surface publique
  n'expose que ce que les adaptateurs consomment (`public-surface.spec.ts`).
- Module watch : rien de neuf — `playback/` (nursery) reste le candidat noté.

## Gate status

- typecheck : ✅ (core + web)
- tests (with coverage) : ✅ 2 517 tests (172 sur chord-chart.spec.ts, +13
  renderChart dont la property), couverture 91,5 % statements — gate stampé
  `9115669e`
- mutation (Stryker, local, diff) : ✅ **91,91** (seuil 90), scope = harmony
  + structure + application + domain + shared + project + separation.
  Survivants du code nouveau audités un par un : tous équivalents par
  invariant (`nextMarkAfter` ne voit jamais une clé ≤ written — flush avant ;
  `renderRow` ne voit jamais volta-undefined après carry actif —
  `voltaBreak` casse avant ; gardes défensives « proven here, not assumed »).
  Piège documenté : Stryker ne mute que le premier conjoint d'un `&&` — une
  mutation manuelle de la condition entière teste un mutant qui n'existe
  pas ; comparer au span exact du rapport JSON avant de conclure au stale.
  Le run CI post-merge reste la référence.
- biome / sheriff / knip / jscpd : ✅
- sonar : PR #363 — analyse CI en attente au moment du rapport ; verdict à
  consigner après la passe CI (commit dédié sur la branche, comme pour la
  PR #362).

## State to resume from

- **Single next action** : après merge de la PR #363, **retour au labo
  starter** (`hexagonal-tdd-starter`) — EN TOUT DERNIER du backlog revue,
  tout le reste est soldé. Le lot « émetteurs structure/ au modèle » (voir
  Not done) est le candidat structurel suivant côté loupe, au choix de
  l'opérateur.
- Gotchas :
  - La property de `renderChart` génère le domaine ATTEIGNABLE : une mesure
    sans accord ni flag structurel, une section anonyme non-première, un
    `repeatCount` sur volta, un `meterChange` à la mesure 0 sans header
    n'ont PAS de forme imprimable — les contraintes sont commentées dans
    l'arbitraire.
  - `renderChart` casse les rangées aux marques et aux fins de groupe volta :
    un texte canonique peut avoir des rangées plus courtes que `barsPerRow`.
  - Le stamp gate ne couvre pas la mutation : purger
    `reports/stryker-incremental.json` n'est PAS nécessaire
    (`mutation-diff.ts` passe déjà `--force`).
