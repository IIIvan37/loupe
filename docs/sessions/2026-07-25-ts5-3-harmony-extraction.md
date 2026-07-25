# Session — 2026-07-25 — ts5-3-harmony-extraction

## Done

- **TS.5.3 — extraction du module `harmony`**
  ([ADR-0005](../adr/0005-modules-emergents.md)) :
  - **Prérequis Mikado : le cycle connu réparé.** `section-matching`
    (blockSimilarity, sequenceAgreement, votedBlock, endingVariants —
    algorithme générique d'accord de séquences sur des labels abstraits)
    promu **entier** en `shared/section-matching.ts` (+ spec) ; le cycle
    conceptuel `harmonic-cycle → section-matching` disparaît.
  - **`harmony/domain/`** (8 fichiers + specs) : `chord-symbol` (feuille),
    `chord-detection`, `chord-key`, `chord-chart`, `chord-engraving`,
    `roman-numeral`, `chroma`, `harmonic-cycle`.
  - **Première depRule inter-features explicite** :
    `'feature:harmony': [sameTag, 'shared', 'feature:rhythm']` —
    `chord-detection` plie les spans sur la beat-grid. Prouvée par le flux
    Mikado lui-même : Sheriff AVANT la ligne = exactement une violation
    (`feature:harmony → feature:rhythm`, rien d'autre) ; APRÈS = vert.
  - `index.ts` ré-exporte depuis le module — aucun changement de surface
    publique ; typecheck vert du premier coup après repointage.
- **`pnpm modules:hint` après extraction : plus aucun candidat par préfixe**
  dans la nursery — les extractions restantes (structure, loops, separation,
  project) sont sous le seuil de 3 ou sans préfixe commun : le plan et le DAG
  prennent le relais de l'outil.
- Rotation sessions : `2026-07-24-ts2-fitness-functions.md` → `archive/`.

## Not done / remaining

- **Restent en nursery, volontairement** (décisions ci-dessous) :
  `bass-line`, `detect-chords`, `chart-structure`, `form-encoder`,
  `song-structure`.
- Extractions suivantes (ordre DAG) : `structure` (song-structure,
  section-matching déjà promu, chart-structure, form-encoder…), `loops`,
  `separation`, `project` ; promotions `nearest-time`/`timecode` avec elles.
- Port `ChordDetector` : reste dans le `ports.ts` nursery — son seul
  consommateur (`detect-chords`) y reste aussi.

## Decisions

- **`detect-chords` reste en nursery** : c'est LA composition déclarée de
  l'ADR-0005 — il traverse harmony (chart, key, detection) + rhythm (grid) +
  structure (form-encoder, song-structure). L'extraire dans harmony aurait
  créé des dépendances harmony → structure à contre-DAG.
- **`bass-line` exclu de harmony** : il importe `spectrum` (DSP générique, le
  futur module `audio`) — l'embarquer aurait exigé de promouvoir `spectrum`
  en shared prématurément ; il attendra `audio`.
- **`section-matching` promu entier** (pas seulement `sequenceAgreement`) :
  tout le fichier est le même algorithme générique ; le découper aurait été
  une frontière artificielle dans un module cohérent.
- La depRule inter-features est **une ligne par arête du DAG conceptuel**,
  jamais un wildcard — l'arête `harmony → rhythm` est la première.

## Gate status

- typecheck : ✅ (vert au premier passage post-repointage)
- tests (with coverage) : ✅ 162 fichiers, 2318 tests
- mutation (Stryker, local, `--force`, depuis la racine) : ✅ 93,34 %
  (seuil break 90) — `harmony/` 94,16 %, `shared/` 92,07 %
- biome / sheriff / knip / jscpd : ✅ (gate complète exit 0)

## State to resume from

- **Single next action** : ouvrir la PR TS.5.3, puis **TS.5.4 — extraction
  `structure`** (`song-structure`, `chart-structure`, `form-encoder`) :
  attendue avec la depRule `feature:structure → feature:harmony` (+ rhythm ?
  la gate le dira) et la promotion `nearest-time` (song-structure +
  snap-loop-region) ; `detect-structure` est un candidat à suivre son module
  (il ne touche que song-structure + beat-grid), contrairement à
  `detect-chords` qui reste une composition nursery.
- Gotchas : lancer Stryker **depuis la racine** (`pnpm exec stryker run
  --force` ; depuis un sous-dossier le dry-run npm échoue « Missing script:
  test ») ; les imports in-cluster (`./chord-*.ts`) survivent au `git mv` tels
  quels, seuls les cross-boundary changent de profondeur.
