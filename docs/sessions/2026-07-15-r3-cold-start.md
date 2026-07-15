# Session — 2026-07-15 — R.3 : busy avant la gate + cold start narré

## Done
- **R.3** (branche `feat/r3-cold-start`, stackée sur R.2/PR #142) :
  - `useStructureDetection` : la face busy monte **avant** `await gate()` —
    le round-trip de mint (Edge Function, ~0,5–1 s) est couvert par le
    feedback depuis le clic ; redescend sur échec de gate. Garde de ticket
    ajoutée : un **cancel pendant le mint** supersède le run — la gate qui
    résout OK ensuite ne lance pas le détecteur.
  - **Cold start narré** : `StructureDetectionControl.mayColdStart`
    (`isAnalysisOffloaded()` au shell) → la face busy affiche après ~4 s la
    ligne `detail` « Démarrage du moteur d'analyse (jusqu'à ~1 min)… »
    (id `structure.cold-start`) — le `detailAfterMs` de la primitive R.1.
    L'attente devient expliquée au lieu d'inquiétante.
  - TDD : busy up pendant un mint gated, cancel-pendant-mint (détecteur
    jamais appelé), detail différée aux fake timers (rangée).

## Not done / remaining
- R.4 : poser le busy + céder un frame avant zipSync/mixedStems, migrer le
  chip header sur la primitive — dernier du lot.
- Le warm-on-import ne couvre toujours pas le premier import d'une session
  (cache de token en mémoire de module) — constat v4 assumé : la narration
  R.3 rend précisément ce cas supportable.

## Decisions
- La gate mint est narrée comme partie de la détection (un seul busy), pas
  comme une étape distincte.

## Gate status
- typecheck : ✅ · tests : ✅ **1459** (+3) · Stryker : skippé (core intouché)
- biome / sheriff / knip / jscpd / check:tokens / react-doctor : ✅

## State to resume from
- **Single next action** : PR de `feat/r3-cold-start` (base
  `feat/r2-detection-cancel`), puis **R.4** : (1) dans `use-stem-export` et
  `project-session.ts`/`use-projects`, poser l'état busy puis
  `await new Promise(requestAnimationFrame)` avant zipSync/mixedStems ;
  (2) migrer le chip header (`<output>` phase+% + .busyCancel) sur
  `OperationStatus` — la peau cancel dupliquée notée en R.1 se résorbe là.
