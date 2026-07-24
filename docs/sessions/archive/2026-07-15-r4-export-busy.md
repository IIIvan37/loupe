# Session — 2026-07-15 — R.4 : busy peint avant le gel + chip header unifié (Lot R clos)

## Done
- **R.4** (branche `feat/r4-export-busy`, stackée sur R.3/PR #143) :
  - **`nextPaint()`** (lib) : double rAF — laisser la ligne busy PEINDRE
    avant qu'un travail synchrone ne gèle le main thread.
  - **Export stems** : `useStemExport.exportStems` pose `exporting` puis
    cède un frame avant le zip synchrone ; le header narre « Export des
    stems… » (id `header.exporting`) — avant, RIEN ne s'affichait jusqu'au
    toast. Testé au shell (busy up synchrone après le clic, down au toast).
  - **Sauvegarde** : `handleSave` pose `preparingSave` + frame avant le
    ré-encodage WAV synchrone de `mixedStems` — le chip « Enregistrement du
    projet… » apparaît AVANT le gel, plus après.
  - **Chip header → `OperationStatus`** : l'`<output>` busy + le bouton
    `.busyCancel` deviennent la primitive (barre réelle pour le
    téléchargement URL — le % quitte la copy `header.downloading` pour la
    barre — indéterminée pour extraction/save/open/export, Annuler
    conditionnel). La peau cancel dupliquée notée en R.1 est résorbée ;
    le chip saved/dirty reste un `<output>` simple.
  - Le vrai fix off-thread (fflate `zip()` async + encode en worker) reste
    en veille STATUS, inchangé — la primitive branchera une vraie
    progression le jour venu.
- **LOT R COMPLET** : R.1 #141, R.2 #142, R.3 #143, R.4 (cette PR) —
  l'irritant « opérations longues = un changement de label » est traité :
  chaque opération longue porte désormais la même face (barre + libellé +
  détail différé + Annuler quand c'est annulable).

## Not done / remaining
- Annonce a11y du décodage (LiveStatus monté trop tard — région persistante
  à prévoir) et annonces zone repliée : notés, candidats W.5/a11y.
- Off-thread zip/encode : veille inchangée.

## Decisions
- Le % du téléchargement vit dans la barre, plus dans la copy
  (`header.downloading` = « Téléchargement… »).
- WorkstationShell recompressé sous les 300 lignes de composant
  (react-doctor no-giant-component) — destructuration `stemExport` repliée.

## Gate status
- typecheck : ✅ · tests : ✅ **1460** (+1) · Stryker : skippé (core intouché)
- biome / sheriff / knip / jscpd / check:tokens / react-doctor : ✅

## State to resume from
- **Single next action** : PR de `feat/r4-export-busy` (base
  `feat/r3-cold-start`), puis **merger la pile R** (#141 → #142 → #143 →
  R.4, chacune se rebase sur la précédente — attention à la course GitHub
  déjà vue sur #139 : retarget la suivante sur main AVANT de supprimer la
  branche mergée, ou merger sans --delete-branch puis nettoyer).
- Ensuite, séquencement roadmap v4 : **W.1/W.2** (micro-slices design),
  puis **U.1/U.3** (gate cloud + sécurité), **T.1–T.3**, **V.1**.
