# Session — 2026-07-16 — t8a-spectrum-chroma

## Done
- **T.8 — décisions produit actées avec l'utilisateur** : spectre = **v1
  honnête chroma** (pas de retrait d'onglet), EQ = **slice BiquadFilter par
  stem, non persistée** (T.8b à suivre).
- **T.8a — l'onglet Spectre vit** (placeholder du Jalon 1 remplacé) :
  - **Core (TDD)** : `chromaFromSpectrum(magnitudes, sampleRate)` — fold pur
    spectre→12 classes de hauteur (convention analyser bin `i` ⇔
    `i·sr/2N` Hz), bande musicale 32–2100 Hz, normalisé à la classe la plus
    forte. 10 tests + property (12 valeurs ∈ [0,1]) ; passe mutation dédiée →
    **34/36 tués** (bande + frontières exactes épinglées), 1 survivant
    équivalent documenté (lecture hors-borne avalée par `?? 0`).
  - **Port** : `SpectrumFrame` + `spectrum?()` optionnel sur les deux moteurs
    (les fakes de test n'ont pas bougé).
  - **Adapter** : le transport partagé route tout l'audible à travers UN
    `AnalyserNode` pass-through avant la destination (sources → stretch → tap
    → destination ; fftSize 4096, dB→linéaire, silence ⇒ 0).
  - **Web** : `ChromaView` — poll 10 Hz **dans la feuille** (le refresh ne
    re-rend jamais le shell), 12 barres teal sur libellés C…B, hint à l'arrêt ;
    `usePlayer.readSpectrum` lit le moteur ACTIF ; câblé shell →
    ShellMain → AnalysisPanel.
  - **Browser-verify sur The Logical Song** : lecture intacte à travers la
    nouvelle chaîne, barres vivantes et musicalement plausibles.

## Not done / remaining
- **T.8b** — EQ low/high-cut par stem (approche validée : port
  `setStemFilter(id, { lowCutHz?, highCutHz? })`, non persisté).

## Decisions
- Chroma : bande 32–2100 Hz, normalisation max=1 — v1 « pics = notes
  candidates », pas un accordeur.
- Barres en divs (pas canvas) : 12 éléments, testables, sur tokens — le
  canvas de la roadmap était un croquis d'implémentation, pas une exigence.

## Gate status
- typecheck: ✅ (via `pnpm gate`)
- tests (with coverage): ✅ **1585 tests** (+15)
- mutation (Stryker, core touché): ✅ **93,39 %** puis passe chroma dédiée
  (34/36, 1 équivalent documenté)
- biome / sheriff / knip / jscpd: ✅

## State to resume from
- **Single next action**: PR de `feat/t8a-spectrum-chroma`, puis **T.8b**
  (EQ) — dernier item du lot T.
- Gotchas / half-done edits: aucun.
