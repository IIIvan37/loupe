# Session — 2026-07-16 — z1-click-out-of-chroma-band

## Done
- **Z.1 (roadmap v5)** : les clics du métronome ne contaminent plus le
  Spectre. À 1000/2000 Hz, les deux tons tombaient DANS la bande chroma
  32-2100 Hz et se repliaient tous deux sur la classe **B** (midi 83/95) :
  une fausse note candidate pulsait à chaque beat, précisément dans le cas
  d'usage visé (relever des notes en jouant en rythme), amplifiée par la
  normalisation au max de `chromaFromSpectrum`.
  - `metronome.ts` : `BEAT_HZ` 1000 → **2400**, `DOWNBEAT_HZ` 2000 → **3200**
    (hors bande, sous Nyquist des sample rates réels ; le caractère percussif
    est porté par l'enveloppe, pas la hauteur — commentaire posé).
  - `chroma.ts` : bornes de bande exportées (`CHROMA_MIN_HZ`/`CHROMA_MAX_HZ`)
    pour que les sons synthétisés in-app puissent PROUVER qu'ils restent hors
    bande.
  - TDD : test rouge d'abord — l'invariant est mesuré **sur les échantillons**
    (fréquence estimée par passages à zéro sur la fenêtre de clic, ≈ 2f/s),
    pas sur les constantes, et comparé à `CHROMA_MAX_HZ` : il survivra à
    toute réécriture du synthé.
- **Browser-verify réel** (kick 80 Hz + nappe 220 Hz à 120 BPM, tempo détecté,
  métronome rendu audible, onglet Spectre, 30 échantillons pendant la lecture
  réelle) : **A = 100 stable (la nappe), B = 1-2** — la fausse note a disparu.
  Piège de mesure consigné : piste finie ⇒ poll arrêté ⇒ barres figées sur la
  dernière frame (un premier échantillonnage « métronome seul » lisait du
  bruit renormalisé figé) — toujours vérifier que le timecode avance.

## Not done / remaining
- Le timbre du clic à 2400/3200 Hz n'a pas été écouté (vérif silencieuse) —
  l'enveloppe exponentielle 30 ms est inchangée, le caractère percussif
  devrait tenir ; à confirmer d'oreille à l'usage.
- Métronome SEUL audible : le chroma normalisé affiche du bruit de plancher
  (toutes classes 30-100, profil plat) — c'est le comportement de la
  normalisation au max sur un signal hors bande, pas une régression ; une
  garde « énergie en bande < seuil ⇒ barres à zéro » serait une micro-slice
  future si ça gêne (non promise).

## Decisions
- Fréquences 2400/2400×4/3 = **2400/3200 Hz** (proposition roadmap v5
  confirmée) : premières fréquences « rondes » au-dessus de la bande, ratio
  d'accent conservé (downbeat plus haut + plus fort).
- Les bornes de bande chroma deviennent une **API du domaine**
  (`CHROMA_MIN_HZ`/`CHROMA_MAX_HZ` exportées) : tout futur son synthétisé
  (count-in, subdivisions en veille) doit se tester contre elles.

## Gate status
- typecheck : ✅
- tests (with coverage) : ✅ **1596 tests** (+1 vs main), coverage ~96,8 %.
- mutation (Stryker, local, core touché) : ✅ **93,90 %** (≥ break 90).
- biome / sheriff / knip / jscpd / react-doctor : ✅.

## State to resume from
- **Single next action** : ouvrir la PR de `feat/z1-click-out-of-chroma-band`,
  puis **AA.1** (Dependabot pip sur server/ — dernier des cinq 🟠, pure
  config, pas de checkpoint).
- Gotchas / half-done edits : aucun. PRs #171 (X.2) et #172 (Y.1) encore
  ouvertes — petits conflits STATUS.md attendus entre elles (concaténer les
  entrées). CI GitHub toujours en panne de facturation.
