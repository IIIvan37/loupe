# Session — 2026-07-23 — AN.4 : gravure Real Book

## Done

- **Core `engraveChordSymbol` / `engraveNote`** (chord-engraving.ts, TDD) :
  couche de formatage pure **display-only** — la source ASCII n'est jamais
  réécrite. Table `QUALITY_RULES` ordonnée : demi-diminué `m/mi/min7b5 → ø`,
  majeur `maj/Maj/ma → M` (**décision actée : pas de triangle △**),
  mineur-majeur `mmaj7 → mM7`, `dim → °`, `aug → +`, accidentals d'exposant
  `b/# → ♭/♯` (devant un chiffre seulement). `engraveNote` grave l'accidental
  **de tête** d'un nom de hauteur (`Bb → B♭`) et laisse la prose verbatim
  (l'ancre `^` est testée par mutant tueur).
- **Refactor `mapChordNotes`** (chord-symbol.ts) : le ternaire « bass
  optionnel » dupliqué ×3 (respell/transpose/engrave) extrait en un helper —
  les trois fonctions deviennent des one-liners.
- **Web `ChordGlyph`** : grave par partie après la garde round-trip existante
  (un token non ré-imprimable reste verbatim, comme la transposition) ; le
  split baseline/exposant (MINOR) opère sur la qualité gravée — `Am7b5` rend
  `A^ø`, `Cmaj7` rend `C^M7`, `C7b9` rend `C^7♭9`.
- **Tonalités affichées gravées** : la tête de grille (`chart.key-of`) et le
  read-out AN.3 (« Tonalité : C → E♭ (+3) ») passent par `engraveNote` — plus
  de « Bb » ASCII imprimé au-dessus d'une grille en B♭.
- **CSS gravure de forme** (lead-sheet.module.css) : vrais points de reprise
  (deux puces empilées par `'•\A•'` + `white-space: pre` — pas de
  `writing-mode`, les insets restent logiques ; fonte chart ; forme alternative
  `/ ''` pour vider le nom accessible des mesures-boutons) ; crochet de volta
  (descendeur = bord gauche du label, décalé de `--space-2xs` pour ne pas
  fusionner avec une double barre `|:`) ; pile `--font-chart` avec repli
  `var(--font-ui)` par glyphe pour `♭ ♯ ° ø` si Petaluma Script ne les porte
  pas.
- **Vérif navigateur** (page scratch reproduisant les règles) : points centrés
  sur les barres, crochet lisible, glyphes `CM7 / Aø / B♭7♭9 / F♯°7` — a
  attrapé le pivot writing-mode des insets logiques avant la revue.
- **Revue 8 angles + 9 correctifs appliqués** : épellations équivalentes
  pliées vers une même gravure (min7b5/Maj7/ma7/mmaj7), points de reprise
  re-fontés/re-dimensionnés, retour aux insets logiques, nom accessible vidé,
  descendeur décollé, clés affichées gravées, `mapChordNotes`, doc
  display-only replacée sur l'export, propriété d'idempotence rendue
  exhaustive (boucles sur la table, fast-check retiré du spec).

## Not done / remaining

- La ligne de feedback AN.2 et les snippets d'aide montrent l'ASCII source —
  voulu (ce sont des surfaces d'édition, pas d'impression).
- `chroma-view.tsx` garde sa table de 12 noms unicode en dur — consolidation
  possible via `engraveNote(spellPitchClass(…))`, en veille.
- La garde `PITCH` locale de chord-glyph.tsx duplique le vocabulaire
  d'accidentals du core (préexistant) — en veille.
- Repli `cursive` retiré de `--font-chart` : si le woff2 Petaluma échoue, la
  chart tombe en Inter (arbitré : le repli par glyphe pour ♭♯°ø prime ; la
  fonte est bundlée localement).

## Decisions

- **`maj7 → M7`, pas de triangle** (décision produit du 2026-07-22, appliquée).
- **La gravure est display-only** : la source reste l'ASCII tapé ; toute
  surface d'édition montre la source, toute surface de lecture montre la
  gravure. Les tonalités affichées suivent la même règle.
- **Une harmonie, une gravure** : les épellations équivalentes (m/mi/min7b5,
  maj/Maj/ma) plient vers la même marque — le même accord ne s'imprime jamais
  de deux façons sur une page.

## Gate status

- typecheck : ✅ (dans `pnpm gate`, exit 0)
- tests (coverage) : ✅ 2055+ tests, statements 97 %+
- mutation (Stryker, local, scoped `--mutate` sur les fichiers touchés) :
  **chord-engraving.ts 100 %**, **chord-symbol.ts 100 %** (run complet core en
  CI post-merge ; le run global local a été interrompu, remplacé par le run
  ciblé après les correctifs de revue)
- biome / sheriff / knip / jscpd : ✅ (gate exit 0)

## State to resume from

- **Single next action** : ouvrir la PR AN.4 (`gh pr create`) puis, après
  merge, STATUS sur `main` (doc-only) et attaquer **AN.5 — chiffrage romain**
  (`IM7`, transform pur core, bascule UI ; réutiliser `engraveChordSymbol`
  pour les qualités des degrés, ex. `iiø`).
- Gotchas : la forme alternative `content: … / ''` exige la déclaration de
  repli au-dessus (moteurs sans support) ; `engraveNote` n'engrave qu'une
  hauteur en tête (texte libre `{key}`) — ne pas « généraliser » l'ancre.
