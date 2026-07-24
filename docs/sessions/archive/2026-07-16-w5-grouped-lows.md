# Session — 2026-07-16 — w5-grouped-lows

## Done
- **W.5 — basses design groupées (roadmap-excellence-4) — LOT W CLOS.**
  Les cinq micro-items en une passe :
  1. **`.kbd` partagé** dans controls.module.css (base = look empty-state,
     `.kbdDialog` = variante panel-3/font-size-s/padding élargi) — les deux
     surfaces composent ; le chip du dialog gagne au passage le min-width et
     le centrage de la base. Vérifié navigateur (computed styles des deux
     surfaces).
  2. **`.secondaryAction` promu** dans controls.module.css (face + hover +
     dip `:active` + disabled — la face seule, les consommateurs gardent
     leurs dimensions) ; header et trigger d'AccountMenu composent — le
     trigger, seul bouton du header sans pressed-feedback, gagne le dip
     (règle partagée vérifiée présente dans le CSSOM). **Écart documenté** :
     les actions de rangée de projects-dialog gardent leur face locale
     (texte dim, hover sans fond — divergences voulues, les fusionner
     changerait leur comportement).
  3. **`styles.section` fantôme** retiré de lead-sheet.tsx (className
     silencieusement `undefined`) ; **check préventif** dans
     check-css-tokens.sh : chaque `styles.X` des TS/TSX doit exister comme
     classe dans le module importé (lignes `import` exclues du scan — le
     `x.module` du chemin faisait un faux positif, trouvé au prototypage).
     Testé en négatif (classe fantôme réintroduite ⇒ exit 1).
  4. **Focus rings dédoublonnés** : les 8 règles identiques à la baseline
     globale (`global.css` `:focus-visible`) supprimées (alert-banner,
     toast-region, marker-controls, marker-rail, analysis-panel,
     stem-headers ×2, waveform-view, projects-dialog ×4) — vérifié qu'aucun
     `outline: none` local ne comptait sur elles ; le `-2px` d'import-menu
     gardé et commenté (ring inset : un +2px clipperait sur le bord arrondi
     du popup).
  5. **Reliquats O.2** : `.sub` de l'empty-state sur `--tracking-label`
     (0.04em → le token 0.08em, une seule voix de tracking), `.tag` du rail
     `1px` → `--space-3xs`, lead-sheet.module.css converti en **propriétés
     logiques** (padding/margin/border/inset — plus aucune propriété
     physique).
- Revue diff → 1 constat fixé (commentaires orphelins laissés par la
  suppression des focus rings, dont un retombé au-dessus du mauvais bloc).

## Not done / remaining
- Rien sur le lot W. Prochain : la suite de la roadmap v4 (le séquencement
  Q → R → W.1/W.2 → U.1/U.3 → T.1–T.3 → V.1 est épuisé — reste « le reste »)
  ou la prochaine évaluation notée.

## Decisions
- Peaux partagées : la face `secondaryAction` et le chip `kbd` vivent dans
  controls.module.css ; les faces divergentes (rangées projects-dialog)
  restent locales tant que la divergence est voulue.
- check:tokens couvre désormais trois invariants CSS : tokens définis,
  pas de `font-size` absolu hors tokens.css, pas de classe fantôme.

## Gate status
- typecheck: ✅ (via `pnpm gate`)
- tests (with coverage): ✅ 1537 tests, 126 fichiers
- mutation (Stryker, local, if core touched): **skippé** — core intouché
  (CSS + 1 ligne TSX + script shell)
- biome / sheriff / knip / jscpd: ✅

## State to resume from
- **Single next action**: ouvrir/merger la PR de `feat/w5-grouped-lows`
  (Lot W clos avec elle), puis choisir : items restants de la roadmap v4
  ou lancer l'évaluation notée v5.
- Gotchas / half-done edits: aucun — arbre propre.
