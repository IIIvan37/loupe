# Session — 2026-07-16 — x2-tempo-cancel-idle

## Done
- **X.2 (roadmap v5)** : annuler la détection automatique du tempo n'est plus
  un cul-de-sac — l'item garde une face idle « Détecter le tempo ».
  - `use-tempo.ts` : nouvel état exposé **`cancelled`** — posé par
    `cancelDetection()` (l'annulation reste sans erreur, décision R.2
    intacte), effacé par `detect()`, `set()` (analyse persistée resseatée) et
    `reset()` (nouvelle piste).
  - `analyser-row.tsx` : `TempoDetectionControl.cancelled` ; l'item tempo
    reste rendu quand `cancelled` et, sans bpm/erreur/run, porte un
    `DetectionAction` idle « Détecter le tempo » câblé sur `onRetry` —
    symétrie avec structure/accords dont le bouton ne disparaît jamais. Un
    cancel par-dessus un tempo déjà posé garde la face « Tempo détecté »
    (le cancel n'efface pas l'analyse).
  - Nouvel id Lingui `analyser.tempo-detect` (+ `i18n:extract`).
- Tests (+7) : 4 sur le hook (marque posée sans erreur, effacée par
  detect/set/reset), 2 sur la rangée (bouton relance câblé sur onRetry ;
  done-face conservée si un tempo existe), 1 parcours shell (annuler
  l'auto-détection → « Détecter le tempo » → clic → BPM affiché).

## Not done / remaining
- Pas de browser-verify dédié : le parcours complet (annuler pendant
  l'auto-détection → relancer → read-out BPM) est couvert au niveau shell
  avec un vrai détecteur contrôlé — rien que le navigateur verrait de plus
  (même critère que les slices N/T de ce type).
- La face idle réutilise le chemin `onRetry` existant (`tempoDetection.retry`)
  — aucun nouveau câblage shell au-delà du booléen.

## Decisions
- **État « annulé » ciblé plutôt qu'item tempo toujours rendu** (checkpoint
  validé) : zéro changement visuel hors du cas annulé ; la symétrie complète
  avec structure/accords (item toujours rendu) reste une option pour M1.1
  quand le tempo partira sur Modal.
- `cancelled` vit dans `useTempo` (pas dans la rangée) : c'est le hook qui
  connaît le cycle de vie des runs (supersede/reset/set), la rangée reste
  dumb.

## Gate status
- typecheck : ✅
- tests (with coverage) : ✅ **1602 tests** (+7), coverage ~96,8 %.
- mutation (Stryker, local, if core touched) : **skippé — core intouché**
  (packages/web seul).
- biome / sheriff / knip / jscpd / react-doctor : ✅ (ShellMain ramené à
  300 lignes pile — le budget react-doctor n'a plus aucune marge : **le
  prochain ajout dans ShellMain devra extraire quelque chose**).

## State to resume from
- **Single next action** : ouvrir la PR de `feat/x2-tempo-cancel-idle`, puis
  enchaîner **Y.1** (hauteur du header de piste vs rangée EQ — 3ᵉ des cinq 🟠,
  slice UI ⇒ checkpoint d'approche : monter `--stem-lane-height` ~64px vs
  replier LC/HC).
- Gotchas / half-done edits : aucun. **CI GitHub en panne de facturation**
  (tous les jobs échouent en 3 s, « recent account payments have failed… ») :
  la gate locale fait foi, le backstop Stryker post-merge ne tourne pas —
  à corriger dans GitHub → Settings → Billing & plans.
