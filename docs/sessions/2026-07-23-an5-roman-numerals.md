# Session — 2026-07-23 — AN.5 chiffrage romain en option

## Done

- **Core `romanizeChordSymbol(symbol, key)`** (TDD strict, 9 tests dont une
  propriété fast-check d'invariance enharmonique) : fondamentale et basse
  slash relues en degrés de la tonalité — table explicite des 12 intervalles
  (`I…VII`, chromatiques bémolisés `♭II/♭III/♭V/♭VI/♭VII`), `mapChordNotes`
  réutilisé (même mécanique que respell/transpose), symbole sans racine
  lisible rendu à l'identique.
- **`ChordGlyph` prop `romanKey`** : romanisation AVANT gravure (les glyphes
  qualité AN.4 s'appliquent par-dessus, `♭VII` traverse `engraveNote` sans
  dégât) ; tokens non ré-imprimables toujours verbatim. Composant **mémoïsé**
  (`React.memo`) — fin du re-parse de chaque accord à chaque frame de lecture.
- **Bascule « Chiffrage romain »** dans la ligne de tonalité du panneau :
  **off par défaut** (une option, décision utilisateur), désactivée avec hint
  tant qu'aucune `{key:}` ne nomme la grille (pas de degré sans tonique),
  `aria-pressed`, préférence par navigateur (`roman-preference.ts`, idiome
  bars-per-row). Affichage seul : la source garde ses lettres.
- **Extraction `PitchDriftFlag`** hors de `ChordChartPanel` (react-doctor
  `no-giant-component` au gate) — extraction pure, l'invariant « LiveStatus
  reste monté quand la rangée du flag disparaît » préservé (composant rendu
  inconditionnellement).
- **Revue `/code-review` medium** (6 angles, vérif croisée) : 2 nettoyages
  appliqués (mapChordNotes + table explicite ; memo), 1 candidat réfuté (la
  basse n'était pas perdue — le spread la gardait), décisions d'épellation
  confirmées comme intentionnelles (voir Decisions).

## Not done / remaining

- Épellation des degrés hors gamme **toujours bémol** même en tonalité dièse
  (`♯IV` n'existe pas, on imprime `♭V`) — décision assumée, à rouvrir
  seulement si un utilisateur de tonalité dièse le réclame.
- Pas de chiffrage minuscule (`ii7`) — option écartée au checkpoint.

## Decisions

- **`IIm7`, pas `ii7`** (choix utilisateur au checkpoint) : majuscules
  partout, la qualité porte le mineur — cohérent avec la gravure AN.4, zéro
  règle de casse.
- **Référence = gamme majeure du tonique, mode ignoré** : en La mineur, C
  se lit `♭III` (idiome jazz-chart), pas `III` d'analyse classique. Épinglé
  par test + commentaire de module.
- **Chromatismes flat-side** (`♭V` de la substitution tritonique, jamais
  `♯IV`) — conforme à la roadmap (« racines hors gamme avec altération
  (♭VII) »).
- **Altération à gauche du chiffre** (`♭VII`, pas `VII♭`) — doute levé en
  session : c'est la convention jazz dominante (Real Book, Levine, Berklee,
  Nashville) ; la variante à droite relève de traités classiques européens.
- **Le chiffrage est une préférence de lecture, pas une donnée de grille** :
  localStorage par navigateur (comme mesures/ligne), jamais le manifest.

## Gate status

- typecheck : ✅ (via `pnpm gate`)
- tests (with coverage) : ✅ 2085 tests, statements 97,1 % / branches 92,5 %
- mutation (Stryker, local, `--force`) : ✅ global 93,08 % (seuil 90) ;
  `roman-numeral.ts` **100 %** — deux mutants équivalents initiaux tués en
  déplaçant le fallback verbatim dans `degreeOf` + test basse non-note
- biome / sheriff / knip / jscpd / impeccable / react-doctor : ✅ (gate exit 0)

## State to resume from

- **Single next action** : ouvrir la PR `feat/an5-roman-numerals` → `main`
  (ce rapport dedans), puis après merge mettre à jour `docs/STATUS.md` sur
  `main` en doc-only (Lot AN clos — AN.1→AN.5 livrées ; prochain : Lot AO,
  AO.1 waveform crête+RMS).
- Gotchas : l'invariant « LiveStatus reste monté » de `PitchDriftFlag` tient
  au call-site non conditionnel dans `ChordChartPanel` — ne jamais le wrapper
  dans `{gridDiverges && …}`. La bascule romaine lit `currentKey` du même
  parse que la feuille : la transposition (qui réécrit `{key:}`) reste
  cohérente sans câblage supplémentaire.
