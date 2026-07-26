# Session — 2026-07-25 — ts5-5-loops-extraction

## Done

- **TS.5.5 — extraction du module `loops`**
  ([ADR-0005](../adr/0005-modules-emergents.md)) :
  - **`loops/domain/`** (3 fichiers + specs) : `loop-region`, `loop-library`,
    `snap-loop-region` — `git mv` pur, aucun changement de code.
  - **Aucun use-case/port à embarquer** : la persistance des boucles passe par
    le port Projects (`ProjectStore`, manifeste complet) qui reste en nursery —
    il embarquera avec le module `project`, pas avec `loops`.
  - **depRule à une arête** :
    `'feature:loops': [sameTag, 'shared', 'feature:rhythm']`. Preuve Mikado :
    Sheriff AVANT la ligne = exactement 1 violation
    (`snap-loop-region.ts → beat-grid`, l'arête attendue) ; APRÈS = vert.
  - `index.ts` : bloc `loops/` inséré à sa place alphabétique (entre
    `harmony/` et `rhythm/`), aucune modification de la surface publique ;
    typecheck vert du premier coup après repointage.
  - Consommateurs nursery repointés : `project`, `speed-trainer`,
    `application/projects` (la nursery importe une feature — sens autorisé).
- `pnpm modules:hint` : toujours aucun candidat par préfixe — le DAG du plan
  pilote les extractions restantes.
- Rotation sessions : `2026-07-24-ts4-testing-subpath.md` → `archive/`.

## Not done / remaining

- Extractions suivantes (ordre DAG) : `separation` (separation, stems,
  instrument-detection, analysis-mix), `project` (project, parse-project) ;
  promotion `timecode` toujours en attente d'un second consommateur module.
- `detect-chords`, `bass-line` restent en nursery (décisions ts.5.3/ts.5.4
  inchangées).

## Decisions

- **Un port ne suit une extraction que s'il appartient à la tranche** :
  contrairement à `TempoDetector`/rhythm et `StructureDetector`/structure, le
  port qui persiste les boucles est le `ProjectStore` (manifeste projet
  entier) — il reste en nursery et partira avec le module `project`.
- **L'arête `loops → rhythm` est réelle et unique** : seul
  `snap-loop-region` lit la beat-grid (snap des bornes A/B) ; `loop-region`
  et `loop-library` sont autonomes. Toujours une ligne par arête.

## Gate status

- typecheck : ✅ (vert au premier passage post-repointage)
- tests (with coverage) : ✅ 162 fichiers, 2320 tests
- mutation (Stryker, local, `--force`, depuis la racine) : ✅ 93,48 %
  (seuil break 90) — `loops/` 96,00 %
- biome / sheriff / knip / jscpd : ✅ (gate complète exit 0 ; seul ajustement :
  `check:fix` pour l'ordre d'imports, la profondeur changeant la clé de tri)

## State to resume from

- **Single next action** : PR ts.5.5 ouverte → merge, puis **TS.5.6 —
  extraction `separation`** (`separation`, `stems`/`stem-set`,
  `instrument-detection`, `analysis-mix`, candidats `stem-export`,
  `waveform-mix`) : vérifier quels use-cases (`separate-track`,
  `export-stems`) et ports (`StemSeparator`, `ArchiveWriter`…) embarquent —
  première extraction avec une vraie tranche application.
- Gotchas : Stryker **depuis la racine** (`pnpm exec stryker run --force`) ;
  après un `git mv` cross-boundary, lancer `pnpm check:fix` (biome re-trie les
  imports dont la profondeur a changé) ; les imports in-cluster survivent tels
  quels.
