# Session — 2026-07-17 — chord-grid-form-rollout

## Done
- **Grammaire** : `:| xN` (compteur de passes sur une reprise, `x`/`×`
  acceptés, rendu ASCII `x`) — parse (`repeatCount` sur `Measure`), unroll
  (`walkForm` généralisé `pass < N`), gardes round-trip (`isPrintableToken`,
  `N.C.`, transpose verbatim). `{form: Nx}` en directive de tête
  (`parseFormRollout`, exporté) : `unrollChart` concatène N passes — playhead,
  `measureSeekTime` et anchors suivent les chorus 2..N gratuitement.
- **Matching tolérant** (`domain/section-matching.ts`) : `blockSimilarity`
  pondérée par position (queue ×0.5, seuil 0.75 conservé), `endingVariants`
  (corps voté / fins par passe — la matière des voltas ; différend de corps
  toléré seulement sous majorité stricte), `sequenceAgreement` (score
  d'autocorrélation), `votedBlock` déplacé ici. `tile` bascule dessus, toutes
  les specs chart-structure vertes sans retouche de fixture.
- **Cycle harmonique** (`domain/harmonic-cycle.ts`) : `detectCycle` par
  autocorrélation à la mesure (lags multiples de 4 ≥ 8, offsets d'intro
  {0,4,8}, seuil 0.8, tail ≤ période/2, le silence n'est jamais une preuve).
- **`deduceInstances`** (chart-structure) : la chanson comme séquence ordonnée
  de passes de sections (`SectionInstance` : voté + brut), flag `structured`.
- **Encodeur DP** (`domain/form-encoder.ts`) : `encodeChartSource` sépare la
  FORME du DÉROULÉ — `{form: Nx}` (rollout, ≥3 passes identiques, refusé si
  fins variantes ou mètre non réentrant), puis DP sur les passes : WRITE,
  `|: :|` (λ=1), `|: :| xN` (λ=2), voltas (λ=3), D.C./Fine final (λ=10/+1,
  validé par déroulement). Coût = mesures écrites + navigation (table
  `NAVIGATION_COST` commentée musicalement — un D.C. doit économiser une page).
  Types à variantes de fin = écriture FIDÈLE (raw), le vote ne nettoie que le
  bruit majoritaire. Fold interdit si le mètre ne revient pas (`segmentRows`
  exporté, même règle que `renderStructuredSource`). Fallback octet-identique
  au rendu plat quand rien n'est structuré (épinglé en spec).
- **Oracle** (propriétés fast-check) : `playedLabels(encode(song)) ≡ song` sur
  intro?+N×cycle+outro?+fin variante (alphabets disjoints), stabilité au
  ré-encodage, comptage préservé sous bruit. L'oracle a réellement attrapé un
  bug (write-run voté battant la volta à coût égal → fix « faithful types »).
- **Câblage `detectChords`** : branche déduction → `encodeChartSource`, le
  rollout imprimé `{form: Nx}` dans la tête (un seul site d'assemblage) ;
  branche sections-connues inchangée.
- **Web** : LeadSheet rend `×N` sur la barre `:|` (badge façon volta) ;
  ChartHeader affiche « Jouer N fois » (id `chart.form-rollout`) ou
  l'annotation prose verbatim ; aide du format enrichie (`:| x3`,
  `{form: 3x}`) ; `i18n:extract` passé.
- **Browser-verify (5173, tempo manuel 120)** : grille
  `{form: 3x}` + `|: C | Am :| x3` + voltas collée — tête « Jouer 3 fois »,
  badge ×3, voltas 1./2. rendus ; à 0:20 (passe 2 du rollout) le playhead
  surligne bien la première mesure écrite. Screenshot vérifié.

## Not done / remaining
- **Segno / D.S. / To Coda ⊕** : hors lot (décision de cadrage) — la grammaire
  ne les connaît pas ; l'encodeur n'émet pas non plus de `{coda}` (le D.C. al
  Coda attendra un besoin réel ; λ élevé le rendrait rarissime de toute façon).
- Survivants Stryker dans `form-encoder.ts` (70,6 % local au fichier, score
  global 91,33 ≥ 90) : surtout les gardes défensives de `cycleRollout`
  (intro/tail ≠ 0, matching des copies) redondantes avec les refus en aval —
  dette de test consciente, pas un trou de comportement.
- Le rollout n'est émis qu'à partir de 3 passes (2 passes = `|: :|`, idiome).

## Decisions
- **Tout en TypeScript core** (pas de Python/music21) : le serveur ne voit
  jamais les beats ; `unrollChart` est l'oracle gratuit. Validé utilisateur.
- **Forme vs déroulé** : le déroulé est UNE directive de tête `{form: Nx}` à
  sémantique de playback (l'unroll la multiplie), jamais ré-encodé en signes.
- **Minimiser lisibilité, pas compression** : coût = mesures écrites +
  λ·navigation ; contraintes dures structurelles (pas de reprises imbriquées,
  D.C. vers l'arrière, fine ⇒ rien après).
- **Fidélité vs nettoyage** : un type dont les passes divergent en fin
  (endingVariants) s'imprime fidèlement hors volta ; le bruit de corps à
  majorité stricte reste voté (comportement historique).

## Gate status
- typecheck : ✅ (gate exit 0)
- tests (couverture) : ✅ 135 fichiers / 1729 tests ; lignes 97,34 %
- mutation (Stryker, local) : ✅ 91,33 % ≥ seuil 90 (survivants notés ci-dessus)
- biome / sheriff / knip / jscpd : ✅ (pre-commit gate vert sur chaque commit)

## State to resume from
- **Single next action** : ouvrir la PR de `feat/chord-grid-form-rollout` vers
  `main` (rapport inclus), puis reprendre le plan cap-client-léger : T2.1
  spike Tauri + licences.
- Gotchas : `{form:}` et `{d.c.}` ne sont jamais émis ensemble (le parseur
  reste total si un humain les combine : le rollout multiplie le déroulé
  entier). Les fixtures 4 mesures avec UNE différence de corps ne matchent
  plus (pondération) — c'était voulu, aucune spec existante ne le faisait.
