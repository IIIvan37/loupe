# Session — 2026-07-15 — W.2 : une seule peau « Confirmer ? » destructive

## Done
- **W.2** (branche `feat/w2-confirm-face`, stackée sur W.1) :
  `.confirmFace` extraite dans controls.module.css (bordure + texte
  `--danger`, fond transparent, graisse 600, dip pressé partagé) — la
  recette header/projects dédupliquée.
  - Header : `.confirmAction` compose la face (son dip local retiré,
    commentaire de tête ajusté).
  - Projects : `.confirmAction` compose la face (gagne la graisse 600 —
    c'est l'unification).
  - Drop-dialog : `.confirm` quitte l'`amberButton` pour la face —
    remplacer la session y est le même acte destructif que le bouton
    rouge du header (décision utilisateur : danger-rouge partout).
  - Analysis-panel : `.entryConfirm` reste la variante outline-inset
    (l'armement ne doit pas décaler la géométrie de la ligne),
    commentaire pointé sur la face.
  - Les confirmations lourdes en quietButton restent intactes (roadmap).

## Not done / remaining
- Focus-ring re-déclaré du projects-dialog : laissé tel quel — c'est le
  lot W.5 (9 copies à purger d'un coup).

## Decisions
- **Danger-rouge est l'intention** pour le deuxième-clic destructif ;
  l'ambre du drop-dialog était la divergence (tranché avec l'utilisateur).

## Gate status
- typecheck : ✅ · tests : ✅ **1462** (inchangé — dedup CSS pur)
- mutation (Stryker) : skippé — core intouché (5 CSS modules)
- biome / sheriff / knip / jscpd / check:tokens / react-doctor : ✅

## State to resume from
- **Single next action** : ouvrir la PR de `feat/w2-confirm-face` (base
  `feat/w1-dense-rows-wrap`), puis merger la pile W.1 → W.2 (retarget
  avant merge, comme la pile R).
- Ensuite : **U.1/U.3** (gate cloud + sécurité), T.1–T.3, V.1 ;
  W.3–W.5 restent au lot W.
