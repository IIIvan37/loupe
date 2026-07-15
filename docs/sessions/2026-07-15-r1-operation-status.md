# Session — 2026-07-15 — R.1 : primitive OperationStatus (Lot R ouvert)

## Done
- **Lot Q mergé sur `main`** : #137, #138 normalement ; #139 fermée par une
  course GitHub (suppression de sa branche de base) — ses commits livrés
  intacts via #140 recibliée sur `main` (commentaire posé sur #139).
- **R.1** (branche `feat/r1-operation-status`, base `main`, PR à ouvrir) :
  - **`OperationStatus`** (`app/ui/`, 5 tests) : la face unique d'une
    opération en cours — barre `<progress>` réelle (0–1) ou indéterminée
    native, libellé, ligne `detail` différée (`detailAfterMs`, prête pour la
    narration cold-start de R.3, réarmée si le délai change), « Annuler »
    seulement si `onCancel`. Peau = celle du bloc progress de la séparation,
    promue (barre avec plancher 10rem — pas de saut de largeur d'item).
  - **`DetectionAction`** : la face running EST une `OperationStatus`
    (prop `progress: {value, detail, detailAfterMs, onCancel}`) — fini le
    bouton désactivé au label swappé, l'irritant rapporté mot pour mot.
  - **Branchements** : séparation (progrès réel streamé + Annuler — la face
    hand-rolled de la rangée disparaît, l'abstraction passe à 4/4), tempo en
    cours, structure/accords (indéterminé — R.2 branchera leur annulation),
    et la branche « Décodage… » de la waveform (wrapper paddé, gouttière
    conservée).
  - Canaux d'annonce inchangés (DetectionAction/LiveStatus les possèdent).
  - Browser-verify (5173, réseau Slow 3G émulé pour tenir la face visible) :
    « Détection des accords… » + barre indéterminée teal en place du bouton.
  - Revue 2 finders (8 angles) : 3 fixés (gouttière du décodage, min-size
    16rem → plancher sur la barre, reset `detailDue`), 2 pré-existants notés
    (focus au body pendant un run — R.2 donnera un bouton Annuler focusable ;
    0 % déterminé pendant la phase « analysing » de la séparation), 2 différés
    (peau cancel dupliquée avec le chip header → R.4 ; item tempo hors
    DetectionAction → justifié, pas de face idle), 1 réfuté (ordre d'imports,
    gate verte).

## Not done / remaining
- **R.2** : exposer `cancel()` sur les trois hooks de détection (~4 lignes
  chacun) et le passer au `progress.onCancel` — le mécanisme abort → sémaphore
  libéré est éprouvé depuis O.5.
- **R.3** : busy avant `await gate()` dans use-structure-detection + narration
  cold start (`detail`/`detailAfterMs` déjà prêts côté primitive).
- **R.4** : peindre le statut avant zipSync/mixedStems + migrer le chip header.

## Decisions
- Checkpoint validé (utilisateur) : R.1 = détections + décodage ; le chip
  header (URL/save/open), déjà correct, migre en R.4.
- La primitive ne porte pas de LiveStatus : les canaux d'annonce restent aux
  propriétaires (mount-early oblige) — le « LiveStatus intégré » de l'enquête
  est réalisé par la composition DetectionAction, pas par la primitive.

## Gate status
- typecheck : ✅
- tests (with coverage) : ✅ **1454 tests** (+5)
- mutation (Stryker) : **skippé — core intouché**
- biome / sheriff / knip / jscpd / check:tokens / react-doctor : ✅

## State to resume from
- **Single next action** : ouvrir la PR de `feat/r1-operation-status`, puis
  **R.2** (cancel des trois détections — core/hooks seulement, pas de
  checkpoint UI nécessaire : le bouton « Annuler » est déjà dessiné par la
  primitive, il suffit de fournir `onCancel`).
- Gotchas : `DetectionProgress` (detection-action) réexpose les props de la
  primitive — tout nouveau knob s'ajoute aux deux endroits ; la face running
  remplace le bouton (focus au body pendant le run, assumé jusqu'à R.2).
