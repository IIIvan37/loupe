# Session — 2026-07-25 — ts5-7-separation-extraction

## Done

- **TS.5.7 — extraction du module `separation`**
  ([ADR-0005](../adr/0005-modules-emergents.md)) — première extraction avec une
  vraie tranche application :
  - **`separation/domain/`** (6 fichiers + specs) : `separation`, `stem-set`,
    `instrument-detection`, `analysis-mix`, `stem-export`, `waveform-mix` —
    `git mv` pur.
  - **`separation/application/`** : `separate-track`, `export-stems` + un
    `ports.ts` local portant les 5 interfaces sorties de la nursery
    (`StemSeparator`, `SeparatedStem`, `SeparationProgress`, `ArchiveFile`,
    `ArchiveWriter`) — l'import `SeparationPhase` de la nursery part avec.
  - **depRule à une arête** :
    `'feature:separation': [sameTag, 'shared', 'feature:audio']`. Preuve
    Mikado : Sheriff AVANT la ligne = exactement 3 violations, toutes vers
    `feature:audio` (`stem-set → track`, `waveform-mix → waveform`,
    `export-stems → wav-encoder`) ; APRÈS = vert.
  - `index.ts` : bloc `separation/` inséré à sa place alphabétique (entre
    `rhythm/` et `shared/`), surface publique inchangée ; typecheck vert du
    premier coup.
  - Le registre `application/README.md` garde ses lignes par convention (les
    modules extraits y restent documentés).
- **Récolte labo — `pnpm test:mutation:diff`** (`scripts/mutation-diff.ts`) :
  mutation scopée aux modules core touchés par la branche (les modules
  émergents donnent les périmètres). Contrat : localement la mutation suit le
  diff (close-step en minutes) ; le run complet reste le job CI post-merge,
  qui fait foi. CLAUDE.md + skill `session-report` mis à jour (aussi : filtre
  `pnpm test <path>` sans `--`, « un seul run lourd à la fois »). **Remonté au
  template** : hexagonal-tdd-starter#27.
- Rotation sessions : `2026-07-24-ts5-2-rhythm-extraction.md` → `archive/`
  (embarquée dans le commit d'extraction — course bénigne avec le commit lancé
  en arrière-plan).

## Not done / remaining

- PR ts.5.6 (#260, module `audio`) : CI verte, **merge refusé au harness**
  (classifier de permissions sur `gh pr merge`) — à merger côté utilisateur ;
  la branche ts.5.7 est empilée dessus et sera rebasée sur `main` après.
- Extraction suivante (ordre DAG) : `project` (`project`, `parse-project`,
  use-cases `projects` + ports `ProjectStore`/`ProjectAudioStore` et le kit
  `testing/` du contrat ProjectStore) ; promotion `timecode` toujours en
  attente d'un second consommateur module.
- `detect-chords`, `bass-line` restent en nursery (décisions ts.5.3/ts.5.4
  inchangées).

## Decisions

- **Un port suit sa tranche, pas son vocabulaire** : `StemSource`/`StemFilter`/
  `StemPlaybackEngine` parlent de stems mais servent le transport multitrack
  (aucun use-case separation ne les consomme) — ils restent en nursery.
- **Échecs de tests sous famine CPU ≠ régression** : deux runs superposés
  (gate + suite) ont produit 9 « échecs » à ~17–33 min par fichier ; la suite
  isolée passe en 13 s. Ne jamais superposer gate/Stryker/suites lourdes sur
  cette machine — un seul run lourd à la fois.

## Gate status

- typecheck : ✅ (vert au premier passage post-repointage)
- tests (with coverage) : ✅ 162 fichiers, 2322 tests (96,75 % statements)
- mutation (Stryker, run complet local, `--force`) : ✅ 93,20 % (seuil break
  90) — `separation/` 95,26 % (190 mutants, 9 survivants préexistants) ;
  `mutation:diff` validé en conditions réelles sur cette branche (scopes
  détectés : `application`, `domain`, `separation` — 1 286 mutants, 93,17 %,
  6 min 20 contre 24 min 30 pour le run complet)
- biome / sheriff / knip / jscpd : ✅ (gate complète exit 0 ; seul ajustement :
  `check:fix` pour l'ordre d'imports)

## State to resume from

- **Single next action** : merger #260 (ts.5.6) puis rebaser
  `refactor/ts5-7-separation-extraction` sur `main`
  (`git rebase --onto main <ancien ts5-6>`), pousser, ouvrir la PR ts.5.7 ;
  ensuite **TS.5.8 — extraction `project`** (la nursery `application/` fondra
  à `detect-chords`/`import-from-url`/`load-track`/`supported-source` + le
  reste de `ports.ts`).
- Gotchas : Stryker **depuis la racine** (`pnpm exec stryker run --force`) ;
  `pnpm test -- <path>` ne filtre PAS (la suite entière tourne) ; un seul run
  lourd à la fois (cf. Decisions) ; `check:fix` après tout `git mv`
  cross-boundary.
