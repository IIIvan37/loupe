# Session — 2026-07-16 — t6-discoverability

## Done
- **T.6 — découvrabilité** (roadmap-excellence-4), les trois volets :
  1. **Dialog « Aide du format »** (`format-help-dialog.tsx`, bouton chip à
     côté de « Modifier ») : 10 lignes statiques exemple → sens couvrant la
     grammaire P.2+ vérifiée contre le parseur (`[Section]`, mesures, deux
     accords/mesure, `N.C.`, `|: :|`, voltas `1.`/`2.`, fermata `C@`,
     `{d.c.}`/`{coda}`/`{fine}`, `{time: N/M}`, directives d'en-tête). La
     grammaire de liste (rangée exemple + explication) promue dans
     `app-dialog.module.css` (`rowList`/`helpRow`) et composée par les deux
     dialogs d'aide (pas de clone jscpd).
  2. **Section « Gestes »** dans le dialog « ? » : clic = se positionner,
     glisser = boucle A/B (Alt : sans aimantation), glisser un tag =
     déplacer (clic : aller au repère, ←/→ : décaler), double-clic =
     réinitialiser un curseur — jusque-là cachés dans des `title`
     survol-seulement, inexistants au tactile. Browser-verify du dialog.
  3. **Affordances AT honnêtes** :
     - Tags du rail : l'activation clavier (clic `detail === 0`) déclenche
       le seek que le label « Aller à » promettait ; un clic pointeur porte
       `detail ≥ 1` et a déjà seeké via pointerup — pas de double-seek
       (testé).
     - Surface waveform : le `<button>` menteur (Entrée ne faisait rien)
       devient un `<div>` pointer-only hors tab order (`data-testid`
       `waveform-surface`, kit + 4 specs migrés), geste documenté dans
       l'aide ; le chemin clavier reste ←/→, L, nudges de poignées.

## Not done / remaining
- T.7 (fine-tune ±50 cents), T.8 (décisions spectre + EQ).

## Decisions
- Les gestes n'ont pas de bindings à dériver : section statique, assumée.
- La surface de geste se requête par testid (convention déjà présente dans
  use-file-drop/zoom-stage specs) — plus de rôle bouton mensonger.

## Gate status
- typecheck: ✅ (via `pnpm gate`)
- tests (with coverage): ✅ **1556 tests** (+7)
- mutation (Stryker): **skippé** — core intouché
- biome / sheriff / knip / jscpd: ✅

## State to resume from
- **Single next action**: PR de `feat/t6-discoverability`, puis **T.7** —
  `fineTuneCents ∈ [−50, +50]` séparé (persisté au manifest avec
  tempo/pitch), hors du modulo 12 de N.3, SoundTouch accepte le
  fractionnaire.
- Gotchas / half-done edits: aucun.
