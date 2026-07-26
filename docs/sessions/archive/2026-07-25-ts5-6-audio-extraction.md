# Session — 2026-07-25 — ts5-6-audio-extraction

## Done

- **TS.5.6 — extraction du module `audio`**
  ([ADR-0005](../adr/0005-modules-emergents.md)) — prérequis découvert en
  cadrant l'extraction `separation` (procédure Mikado, un seul niveau de
  prérequis) :
  - **`audio/domain/`** (6 fichiers + specs) : `waveform`, `downmix`, `track`,
    `wav-encoder`, `wav-decoder`, `spectrum` — `git mv` pur, aucun changement
    de code. C'est la base du DAG conceptuel du plan
    (`audio ← rhythm ← harmony ← structure ← project`), le module que
    `bass-line` attend.
  - **Aucune nouvelle depRule** : les consommateurs hors module sont la nursery
    (`load-track`, `bass-line`, `stem-set`, `waveform-mix`, `export-stems`) et
    `index.ts` — sens déjà autorisés (`nursery → feature:*`,
    `core:api → feature:*`). Preuve Mikado : Sheriff vert au premier passage
    après le `git mv`, zéro ligne de config ajoutée.
  - **Pas de promotion `shared/`** : `buildWaveform`, `encodeWav`… sont des
    algorithmes signal, pas du langage kernel — leur foyer est un module, pas
    le noyau (voir Decisions).
  - Aucun use-case/port n'embarque : `AudioFileDecoder` sert `load-track` qui
    reste en nursery.
  - `index.ts` : repointage des 6 exports vers `audio/domain/`, surface
    publique inchangée ; typecheck vert du premier coup.
- Rotation sessions : `2026-07-24-ts5-1-modules-mechanism.md` → `archive/`.

## Not done / remaining

- **TS.5.7 — extraction `separation`** (la tranche visée au départ) :
  `separation`, `stem-set`, `instrument-detection`, `analysis-mix`,
  `stem-export`, `waveform-mix` + use-cases `separate-track`/`export-stems` +
  ports `StemSeparator`/`SeparatedStem`/`SeparationProgress`/`ArchiveFile`/
  `ArchiveWriter` ; depRule attendue `separation → audio`.
- Puis `project` ; promotion `timecode` toujours en attente d'un second
  consommateur module ; `detect-chords`, `bass-line` restent en nursery
  (décisions ts.5.3/ts.5.4 inchangées).

## Decisions

- **Le cluster signal est un module, pas des promotions `shared/`** : la
  frontière Mikado de `separation` tirait `track`, `waveform`, `wav-encoder`
  depuis la nursery. Plutôt que de promouvoir trois fichiers d'algorithmes en
  kernel (réservé au *langage* partagé : types valeurs, `median`,
  `nearest-time`…), on extrait le module `audio` que le DAG du plan prévoyait
  déjà — `separation → audio` devient une arête inter-modules explicite
  (ts.5.7).
- **Une extraction = une PR, même pour un prérequis** : le prérequis `audio`
  a sa propre PR au lieu de gonfler celle de `separation`.
- Les specs sont invisibles pour Sheriff : `spectrum.spec.ts` importe `chroma`
  (harmony) pour un test d'intégration chroma-sur-spectre — toléré tel quel,
  seul le code de production porte les frontières.

## Gate status

- typecheck : ✅ (vert au premier passage post-repointage)
- tests (with coverage) : ✅ 162 fichiers, 2320 tests (96,75 % statements)
- mutation (Stryker, local, `--force`, depuis la racine) : ✅ 93,05 %
  (seuil break 90) — `audio/domain/` 93,42 % (mutants survivants
  préexistants : `git mv` pur, aucun code modifié)
- biome / sheriff / knip / jscpd : ✅ (gate complète exit 0 ; seul ajustement :
  `check:fix` pour l'ordre d'imports, la profondeur changeant la clé de tri)

## State to resume from

- **Single next action** : PR ts.5.6 ouverte → merge, puis **TS.5.7 —
  extraction `separation`** : `git mv` des 6 fichiers domain + 2 use-cases,
  créer `separation/application/ports.ts` avec les 5 interfaces sorties de la
  nursery (`StemSeparator`, `SeparatedStem`, `SeparationProgress`,
  `ArchiveFile`, `ArchiveWriter` — l'import `SeparationPhase` de
  `application/ports.ts` part avec), depRule
  `'feature:separation': [sameTag, 'shared', 'feature:audio']`, mettre à jour
  le registre `application/README.md`. Les ports `StemSource`/`StemFilter`/
  `StemPlaybackEngine` restent en nursery (transport multitrack, pas la
  tranche separation).
- Gotchas : Stryker **depuis la racine** (`pnpm exec stryker run --force`) ;
  après un `git mv` cross-boundary, lancer `pnpm check:fix` (biome re-trie les
  imports dont la profondeur a changé) ; les imports in-cluster survivent tels
  quels.
