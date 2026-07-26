# Session — 2026-07-25 — ts5-8-project-extraction

## Done

- **TS.5.8 — extraction du module `project`**
  ([ADR-0005](../adr/0005-modules-emergents.md)) — le sommet du DAG, avec ses
  trois prérequis Mikado (un commit chacun, gate verte à chaque pas) :
  - **Prérequis 1 — `mixer` rejoint `separation/domain/`** : c'est le mixer
    des stems (un canal par stem, `effectiveGains` pour le bus multitrack) ;
    ses seuls consommateurs core étaient la tranche project.
  - **Prérequis 2 — module `markers`** (`markers/domain/` : `marker`,
    `marker-list`) : même relation que loops — une feature de session que le
    manifest persiste. Aucune depRule propre (la règle `feature:*` suffit).
  - **Prérequis 3 — `fineTuneOrDefault` rejoint `fine-tune.ts`** (nursery) :
    project stocke les scalaires bruts, les lecteurs re-clampent via le
    concept propriétaire — contrat déjà documenté pour
    `clampPlaybackRate`/`clampPitchSemitones` ; fine-tune était l'exception
    (son re-clamp vivait dans `project.ts`). Signature structurelle
    (`{ fineTuneCents?: number }`) : pas d'import nursery → feature.
  - **`project/domain/`** : `project`, `parse-project` (+ specs) ;
    **`project/application/`** : use-cases `projects` + `ports.ts` local
    portant `ProjectStore`/`ProjectAudioStore` sortis de la nursery ;
    **`project/testing/`** : `in-memory-project-store`,
    `project-store-contract` (+ spec) — première extraction qui emporte son
    kit testing ; le barrel `core/src/testing` ne fait plus que re-exporter.
  - **depRule à quatre arêtes** : `'feature:project': [sameTag, 'shared',
    'feature:loops', 'feature:markers', 'feature:rhythm',
    'feature:separation']` — project est le puits du DAG : le manifest
    persiste ce que les autres features modélisent. Sheriff vert au premier
    passage après les prérequis.
  - Surface publique inchangée (`index.ts` repointé) ; le registre
    `application/README.md` garde ses lignes par convention.

## Not done / remaining

- PR ts.5.8 à ouvrir (cette branche) puis merger ; STATUS + Suivi du plan à
  mettre à jour sur `main` en doc-only après merge.
- **La nursery `domain/` est désormais ~toute transport** : `transport`,
  `playback-rate`, `pitch-shift`, `fine-tune`, `seek-step`, `viewport`,
  `speed-trainer`, `key-bindings` (+ `bass-line`, `timecode`).
  `modules:hint` ne voit pas de préfixe ×3, mais le cluster conceptuel est
  net — candidat `transport` à trancher quand on retouchera la zone ; la
  constante de transport coincée dans `key-bindings` (cycle connu du plan)
  se réparera à ce moment-là.
- `timecode` attend toujours un second consommateur module ; `detect-chords`,
  `bass-line` restent en nursery à dessein.
- TS.6 (resync link-checker docs) puis Lot AQ.

## Decisions

- **`mixer` appartient à `separation`, pas à `project`** : le manifest ne fait
  que persister `MixerState` ; le concept (canaux = stems, gains du bus) est
  du côté séparation. Le futur pilote store Jotai (separation+mixer) confirme
  l'adjacence.
- **Le re-clamp vit avec le clamp** (`fineTuneOrDefault` → `fine-tune.ts`) :
  la règle « old manifest » de project ne justifie pas d'importer un concept
  de tuning ; type structurel plutôt qu'import de `ProjectTuning`.
- **Un kit testing suit sa tranche** : `project/testing/` est le premier
  `<feature>/testing` réel — le tag Sheriff placeholder `layer:testing`
  fonctionne sans édition de config.

## Gate status

- typecheck : ✅ (une itération : doublon `fineTuneOrDefault` dans `index.ts`)
- tests (with coverage) : ✅ 162 fichiers, 2323 tests (96,75 % statements)
- mutation (Stryker, `test:mutation:diff`, scopes `application`, `domain`,
  `markers`, `project`, `separation`) : ✅ 93,34 % (seuil break 90) —
  `project/` 98,59 % (350 mutants, 0 survivant nouveau), `markers/` 100 %
- biome / sheriff / knip / jscpd : ✅ (gate complète exit 0 ; `check:fix`
  pour l'ordre d'imports après les `git mv`, comme aux extractions
  précédentes)

## State to resume from

- **Single next action** : ouvrir la PR ts.5.8
  (`refactor/ts5-8-project-module` → `main`), merger, puis doc-only sur
  `main` : STATUS + Suivi de `template-sync-plan.md` (TS.5.8 ✅) ; ensuite
  **TS.6** (link-checker `docs.spec.ts`).
- Gotchas : Stryker plante si `coverage/` (résidu transitoire de la gate)
  traîne à la racine — `rm -rf coverage .stryker-tmp` avant
  `test:mutation:diff` ; `pnpm test -- <path>` ne filtre PAS ; un seul run
  lourd à la fois.
