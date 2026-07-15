# Session — 2026-07-15 — R.2 : annulation des trois détections

## Done
- **R.2** (branche `feat/r2-detection-cancel`, stackée sur R.1/PR #141) :
  - `cancel()` exposé sur `useChordDetection` et `useStructureDetection`
    (abort du controller + bump du run-token + `setDetecting(false)`) et
    `cancelDetection()` sur `useTempo` (`supersede()` + busy down) — le
    chemin abort → libération du sémaphore serveur est celui d'O.5, déjà
    éprouvé. Annuler n'est pas un échec : aucun code d'erreur n'apparaît,
    aucun outcome tardif ne commit (garde de run-token).
  - Câblés sur le `progress.onCancel` des faces busy (structure, accords,
    tempo — y compris la face retry) : le bouton « Annuler » que la
    primitive R.1 dessinait conditionnellement apparaît maintenant sur les
    quatre flux. Au passage, la face busy regagne un élément focusable
    (le pré-existant « focus au body pendant un run » noté en R.1).
  - TDD : test hook (run gated → cancel → busy down, résolution tardive sans
    commit) + test rangée (« Annuler » sur la face busy → onCancel).

## Not done / remaining
- R.3 (busy avant `await gate()` + narration cold start) — prochain.
- R.4 (statut peint avant zipSync + migration chip header).

## Decisions
- Annulation = pas d'outcome : ni erreur ni succès, l'état revient à l'idle
  (l'éventuel résultat précédent reste en place).

## Gate status
- typecheck : ✅ · tests : ✅ **1456** (+2) · Stryker : skippé (core intouché)
- biome / sheriff / knip / jscpd / check:tokens / react-doctor : ✅

## State to resume from
- **Single next action** : PR de `feat/r2-detection-cancel` (base
  `feat/r1-operation-status`), puis **R.3** : dans `use-structure-detection`,
  monter `setDetecting(true)` AVANT `await gate()` (redescendre sur échec de
  gate) et passer `detail`/`detailAfterMs≈4000` (« Démarrage du moteur
  d'analyse… », id `structure.cold-start`) quand `isAnalysisOffloaded()` —
  la primitive a déjà tout côté rendu.
