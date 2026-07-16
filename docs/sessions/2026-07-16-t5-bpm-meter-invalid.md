# Session — 2026-07-16 — t5-bpm-meter-invalid

## Done
- **T.5 — champs BPM/mètre au standard N.4** (roadmap-excellence-4) :
  `CommitNumberField` (panneau tempo) aligné sur le motif BarsPerRowField —
  prop `isValid` (« le hook prendrait-il ce nombre TEL QUEL ? ») +
  `aria-invalid` pendant la frappe + suivi `validity.badInput`, bordure
  danger (même recette CSS que N.4, variantes :hover/:focus-visible pour
  battre les règles composées de numberField).
  - **BPM** : flag quand hors `[MIN_MANUAL_BPM, MAX_MANUAL_BPM]` —
    `normalizeManualBpm` clampait 500 → 400 en silence.
  - **Mètre** : flag hors bornes (rejet silencieux) **et** fractionnaire —
    `overrideMeter` floorait 4,5 → 4 en silence.
  - Escape nettoie draft + badInput ; un draft vide reste transitoire
    (jamais flaggé) ; le flag tombe au commit (le champ retombe sur la
    valeur appliquée). **Présentation seule** — contrats de `useTempo`
    inchangés (TDD : 5 tests panneau, dont « pas de flag en dedans » et
    « le flag tombe au settle »).

## Not done / remaining
- T.6 (aide format/gestes/AT), T.7 (fine-tune cents), T.8 (décisions).

## Decisions
- Le prédicat du flag est « pris verbatim » : un floor silencieux compte
  comme une mutation à flagger, pas seulement le rejet.

## Gate status
- typecheck: ✅ (via `pnpm gate`)
- tests (with coverage): ✅ **1549 tests** (+5)
- mutation (Stryker): **skippé** — core intouché (présentation web seule)
- biome / sheriff / knip / jscpd: ✅

## State to resume from
- **Single next action**: PR de `feat/t5-bpm-meter-invalid`, puis **T.6** —
  popover « Aide du format » (grammaire P.2+, mécanique ShortcutsDialog),
  section « Gestes » dans l'aide « ? », affordances AT honnêtes (onClick de
  seek sur les tags du rail sans double-seek, surface waveform hors tab
  order).
- Gotchas / half-done edits: aucun.
