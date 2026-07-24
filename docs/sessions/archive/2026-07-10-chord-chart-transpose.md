# Session — 2026-07-10 — chord-chart-transpose

## Done
- **Core** : `transposeChartSource(source, semitones)` pur dans
  `domain/chord-chart.ts` — transpose le **texte source** de la grille (la
  vérité persistée) en préservant la mise en page verbatim : en-têtes, lignes
  vides, espaces, structure de rangées. Exporté sur la surface publique du
  core (seul export nécessaire — `transposeChordSymbol` reste interne,
  outside-in + knip).
- **Web** : boutons **−½ / +½** dans l'en-tête du panneau Grille d'accords
  (`chord-chart-panel.tsx`) — chaque clic réécrit la source via
  `transposeChartSource(source, ±1)`, donc la transposition persiste comme
  n'importe quelle édition (dirty-flag et sauvegarde gratuits). Clés Lingui
  `chords.transpose-up/down`, catalogue extrait.
- **Revue post-slice (8 angles, vérification en exécutant le code), 4 findings
  confirmés dont 3 corrigés** :
  1. *Perte irréversible* : un token que parse∘format ne re-imprime pas à
     l'identique (`C/E/G`) était réécrit avec perte (`+1` → `C#/F`, le `−1` ne
     restaurait pas) → **garde round-trip par token** — tout token lossy passe
     verbatim à tout intervalle.
  2. *Semitones non entiers/NaN* produisaient le token littéral `undefined`
     → garde `Number.isInteger` (identité).
  3. *Accidentals unicode* : `B♭ −1 → A#♭` → `♭`/`♯` reconnus comme pitch
     classes (`B♭ −1 → A`), sortie orthographiée en dièses ASCII.
  4. *(assumé, non corrigé)* les mots d'annotation à lettre de note
     (`Capo → C#apo`) : contrat du format — chaque token d'une ligne EST un
     accord, le renderer les traite déjà ainsi.
- **Refactors sous vert** : tokenisation unifiée (constante `TOKEN` partagée
  par `parseRow` et le transposeur — plus de double grammaire) ; la garde
  d'octave au niveau source, devenue code mort après la garde round-trip,
  supprimée (l'identité d'octave passe par la garde de `transposeNote`) ;
  chip-buttons factorisés (`chipRow`/`chipButton` dans `controls.module.css`,
  composés par le tempo-panel et le panneau grille — clone jscpd résorbé,
  8 → 7).
- **Stryker 100 %** sur `chord-chart.ts` et `chord-symbol.ts` — trois vagues
  de mutants tués par des tests dédiés (garde d'octave via token malformé,
  en-tête indenté à label chordé, parse du token vide) puis par élimination
  du code mort et un `charAt(1)` qui supprime un mutant équivalent.

## Not done / remaining
- Syntaxe d'annotation dans le format grille (protégerait `Capo`, `D.S.`…
  de la transposition ET du rendu-comme-accord) — incrément futur du format.
- Sync lecture lead-sheet (surlignage mesure courante), bars-per-row
  configurable — suite du Lot B du plan chord-charts.
- Lot J (roadmap-excellence-2).

## Decisions
- **La transposition opère sur le texte source, pas sur le `ChordChart`
  parsé** : la source est la vérité persistée et l'éditeur ; réécrire les
  tokens en place préserve la mise en page de l'utilisateur et rend la
  persistance gratuite. Pas de compteur d'offset — la source transposée
  devient la nouvelle vérité.
- **Garde round-trip par token** : on ne réécrit un token que si
  `format(parse(token)) === token` ; c'est l'invariant qui rend la
  transposition sûre sur un format à vocabulaire ouvert.
- `<div>` (et non `<header>`) pour l'en-tête du panneau : le role-mapper de
  Testing Library exposerait un second landmark `banner` (bug de scoping
  ARIA du mapper) — assumé avec commentaire.

## Gate status
- typecheck: ✅ (via `pnpm gate`, exit 0)
- tests (with coverage): ✅ 859 tests (+18), coverage 96,22 % st / 89,72 % br
- mutation (Stryker, local): ✅ score global **95,09** (seuil 80) ;
  `chord-chart.ts` **100 %**, `chord-symbol.ts` **100 %**
- biome / sheriff / knip / jscpd: ✅ — clones 8 → 7 (chip-button factorisé)

## State to resume from
- **Single next action** : ouvrir la PR de `feat/chord-chart-transpose`
  (3 commits + ce rapport), puis choisir : incrément lead-sheet (sync lecture,
  bars-per-row) ou Lot J.
- Gotchas : la transposition sort en dièses ASCII (politique d'orthographe
  assumée) ; les mots d'annotation restent traités comme des accords — c'est
  le format, pas un bug de la transposition.
