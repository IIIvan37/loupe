# Session — 2026-07-13 — chord-grid-vocab-key

Améliorer la génération de la grille d'accords avant la démo : orthographe
tonale (# vs b selon la tonalité) + vocabulaire d'accords étendu.

## Done

- **#1 Orthographe tonale (core, pur, TDD)**
  - `chord-symbol.ts` : `FLAT_NAMES`, `spellPitchClass`, `pitchClassOf`,
    `respellNote`, `respellChordSymbol`, type `Accidental`. Ré-épelle une
    racine/basse sans la déplacer (`A#`→`Bb`), naturels et inconnus intacts.
  - `chord-key.ts` (nouveau) : `detectKey(spans)` — profil de hauteurs pondéré
    par durée (racine + tierce maj/min inférée de la qualité) corrélé (Pearson)
    aux 24 profils Krumhansl-Kessler → tonique + mode. `keyAccidental`
    (ensembles de toniques bémol par mode), `keyName` (tonique épelée + `m`).
  - `chord-chart.ts` : `respellChartSource(source, accidental)` — squelette de
    réécriture de tokens **factorisé** avec `transposeChartSource`
    (`rewriteChordTokens`, jscpd vert). Ré-épelle aussi la valeur `{key:}`.
  - `detect-chords.ts` : le use-case détecte la tonalité, ré-épelle le brouillon
    sous son accidentel, et **préfixe `{key: …}`** (l'app affiche « key of X »).
- **Vocabulaire étendu (serveur)**
  - Bascule vers le grand checkpoint BTC `btc_model_large_voca.pt`
    (`num_chords: 170`, sha256 `1673d23f…`, pipeline CQT **inchangé** —
    vérifié : `large_voca` ne touche que le jeu de labels). Repli
    `LOUPE_CHORDS_VOCA=majmin`.
  - `chord_spans.py` : table `LARGE_VOCABULARY` générée (12 racines × 14
    qualités + `X` + `N`, = `idx2voca_chord()` verbatim), paramètre
    `vocabulary` sur `chord_spans`.
- **Web adapter** : `toGridToken` — table `QUALITY_TOKENS` mappant les
  qualités du grand vocabulaire vers les tokens lead-sheet (`min7`→`m7`,
  `hdim7`→`m7b5`, `maj6`→`6`, `minmaj7`→`mM7`, …). Renversements déjà gérés.
- **Vérif end-to-end sur *The Logical Song*** (grand checkpoint réel) :
  détection → `C:min6 / G#:maj7 / G:min7 / F:7` (6tes/7es présentes), tonalité
  détectée **Do mineur** (bémols), brouillon ré-épelé `D#→Eb`, `G#maj7→Abmaj7`,
  `A#→Bb`. Exactement le comportement demandé.

## Not done / remaining (hors périmètre de ce lot, décidé avec l'utilisateur)

- **Multi-accords par mesure auto** : reporté. Le modèle de données le supporte
  déjà (`Measure.chords` tableau, parseur `| C G |`), seule l'agrégation
  `chordLabelPerMeasure` réduit à 1 accord/mesure. À faire dans
  `chord-detection.ts` (subdiviser la mesure) — pur core, zéro serveur.
- **#2 Marqueurs ↔ structure** (types structure/indicatif, propagation des
  éditions manuelles) : lot suivant. Décisions prises : deux `kind`, en-têtes
  `[Section]` = autorité.
- **#3 Signatures rythmiques** (4/4, 2/4 et changements) : lot suivant.
- **Limite v1** : le réétiquetage de structure (S.3b, `renderStructuredSource`)
  ne reporte pas les directives → le `{key}` disparaît de l'en-tête après un
  « Détecter la structure » (les accords gardent leur orthographe bémol).

## Decisions

- Tonalité **auto-détectée** (Krumhansl), surchargeable par `{key}` ; le
  brouillon détecté porte désormais un `{key}` (honnête : l'app détecte
  vraiment, éditable — lève le « never a hardcoded lie » de `chart-header`).
- Orthographe = choix **# vs b par tonalité** (deux tables), pas d'épellation
  diatonique complète — couvre la plainte (A#→Bb en tonalité bémol).
- Grand vocabulaire par **défaut** (musicalement utile) ; maj/min via env.

## Gate status

- typecheck / biome / sheriff / knip / jscpd : **vert** (`pnpm gate` EXIT 0).
- tests (couverture) : **1322 web+core**, couverture ~96 %.
- serveur : **199 pytest**, couverture 97,8 %.
- mutation (Stryker core) : **93,94 % global** (seuil 80). `chord-symbol` et
  `detect-chords` 100 %, `chord-chart` 97,5 %. `chord-key` 73,7 % : survivants
  restants = **mutants équivalents** dans la corrélation Krumhansl (constantes
  de profil, termes symétriques mean/variance, branche `denom===0`
  inatteignable) — ne changent jamais l'argmax pour des tonalités nettes.

## State to resume from

- **Single next action** : ouvrir la PR `feat/chord-grid-vocab-key` (branche
  prête, gate + Stryker verts, end-to-end vérifié). Puis, optionnel avant la
  démo : passe navigateur live sur *The Logical Song* (serveur sur origine
  5173) pour confirmer le rendu grille + en-tête tonalité.
- Gotchas : le grand checkpoint se télécharge au 1er `/chords` (~12 Mo, épinglé
  sha256) ; pour tester en local sans re-download, `LOUPE_CHORDS_CHECKPOINT`
  pointe un fichier local. `LOUPE_CHORDS_VOCA=majmin` revient au 25-classes.
