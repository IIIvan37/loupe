# Session — 2026-07-12 — p1-chart-rendering

## Done
- **P.1 — Rendu chart** sur `feat/p1-chart-rendering` (checkpoint d'approche
  validé : Petaluma Script OFL + ChordGlyph/barres/en-tête dérivé).
- Core (TDD) : `parseChart` lit les directives de tête `{k: v}` (`title`,
  `artist`, `key`, `tempo`, `style`) dans `ChordChart.directives` — clés
  insensibles à la casse, valeurs gardant leurs `:` internes, zone de
  directives strictement **avant** tout contenu de grille (P.2 réclamera les
  `{d.c.}` en-grille). La transposition passe toute ligne-directive verbatim.
  `parseChordSymbol` rejoint la surface publique (consommateur : ChordGlyph).
- Web : `ChordGlyph` (fondamentale + `m` mineur en grand, extension en
  exposant, basse slash empilée dessous-droite ; garde verbatim
  parse∘format + racine non-pitch type `N.C.`), `ChartHeader` (key of X /
  ♩=BPM / titre / artiste / 4/4 / style — dérivé de la session, surchargé
  champ à champ par les directives), `deriveChartHeader` (tags → nom de
  fichier, jamais de placeholder artiste). Barres de mesure dessinées
  (verticales seules, doubles aux frontières de section), labels encadrés.
- Police **Petaluma Script** (SIL OFL 1.1) bundlée localement
  (`packages/web/src/styles/fonts/` + `OFL.txt`), token `--font-chart`.
- Vérif visuelle navigateur contre la maquette « Your Song » : en-tête complet
  (key of E♭ / ♩=127 / titre script / artiste / 4/4 pop ballad), glyphes
  conformes (Fᵐᵃʲ⁷, Dm⁷, Am sur /G), wash ambre de la mesure jouée conservé.

## Not done / remaining
- P.2 (grammaire de forme + unroll + sync lecture), P.3 (édition repliée),
  P.4 (impression, au fil de l'eau).
- Le `4/4` s'affiche inline (pas la fraction empilée de la maquette) et les
  reprises/voltas/D.C./⊕/point d'orgue viennent en P.2 — conformes au plan.

## Code review (8 angles, avant PR)
- Corrigés : `{key: …}` **suit désormais la transposition** (seule directive
  non-verbatim — l'en-tête ne ment plus après ±½ ton) ; regex MINOR affiné
  (`madd9` garde son `m` en base, seuls `ma`/`ma7`/`maj…` sont majeurs) ;
  `{key:}` vide n'imprime plus de « key of » orphelin (helper `over`) ;
  classe fantôme `chartKey` supprimée ; « key of {key} » routé par **Lingui**
  (`chart.key-of`, prose anglaise ≠ notation — extract fait).
- Déférés (notés) : dénominateur `/4` codé en dur (le domaine n'a pas de
  dénominateur — extension modèle, pas patch d'affichage) ; garde round-trip
  parse∘format dupliquée core/web (à factoriser en P.2) ; fallback titre
  `tags → trackName` en 3 exemplaires (helper à extraire).

## Decisions
- **Pas de tonalité détectée dans l'app** (l'en-tête du shell n'affiche aucune
  détection) : la ligne « key of X » n'existe que via la directive `{key: …}`
  — jamais de valeur inventée. Le plan disait « tonalité détectée » à tort.
- Les libellés d'en-tête chart (`♩ =`, `4/4`) sont de la **notation musicale
  imprimée** (contenu du document, comme les lettres d'accords) → pas
  d'entrée Lingui ; « key of » est de la prose → **Lingui** (`chart.key-of`).
- La directive `{key: …}` est la **seule** réécrite par la transposition ;
  toute autre directive passe verbatim (`{title: C major}` ne bouge pas).
- En-tête masqué sur grille vide (sinon il dupliquerait le titre du header
  d'app au-dessus de rien).
- Typographie : le `m` mineur reste en ligne de base (maquette `Dm⁷`), seule
  l'extension passe en exposant ; `ma…`/`maj…` entier en exposant.
- `deriveChartHeader` extrait dans `derive-chart-header.ts` (règles
  react-doctor : shell ≤ 300 lignes, pas d'export non-composant).

## Gate status
- typecheck : ✅
- tests (with coverage) : ✅ (gate complet vert — 50 specs core chord-chart,
  660+ web dont ChordGlyph ×7, ChartHeader ×12, LeadSheet ×12)
- mutation (Stryker, local) : ✅ 95.28 global ; `chord-chart.ts` 99.21 (1
  survivant pré-existant équivalent dans `cellToken` ; les deux survivants
  introduits par la slice — `trim` du garde directive, `trim/toLowerCase` du
  nom de directive key — tués par tests dédiés)
- biome / sheriff / knip / jscpd / react-doctor : ✅

## State to resume from
- **Single next action** : ouvrir la PR de `feat/p1-chart-rendering` puis,
  après merge, attaquer **P.2** (grammaire de forme : `|:` `:|`, voltas,
  `{d.c.}`/`{coda}`/`{fine}`, `unrollChart` pur + `measureIndexAt` sur la
  forme déroulée) en TDD strict, autonomie complète (lot domaine).
- Gotchas : le PDF de référence reste **non versionné** à la racine ; la zone
  de directives est fermée dès la première section/ligne de grille (contrat
  sur lequel P.2 s'appuie pour `{d.c.}`) ; les lignes `{…}` passent verbatim
  sous transposition **où qu'elles soient** (déjà prêt pour P.2).
