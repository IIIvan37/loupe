# Session — 2026-07-21 — am1-clickable-lanes

Lot AM, slice **AM.1** — lanes cliquables. Branche
`feat/am1-clickable-lanes`, PR à ouvrir.

## Done
- **Toute couche cale la lecture.** `StemLanes` gagne une **surface pointeur
  unique** couvrant toutes les lanes (au niveau du conteneur, pas par lane) :
  un clic n'importe où sur les stems appelle `onSeekRatio` avec la fraction
  0–1 de la timeline (même lib `pointerRatio` que la waveform principale →
  zoom-agnostique). Câblée dans `shell-stage` depuis le même `onSeekRatio`
  (`seekToRatio`) que la waveform.
- **Curseur de survol cohérent.** Un **seul** trait vertical traverse toutes
  les lanes en suivant le pointeur (`onPointerMove`), effacé au
  `pointerLeave` — mirror visuel du `.hover` de la waveform, pas N lignes
  concurrentes.
- **Idiome partagé.** Surface délibérément **NON bouton** (comme la surface
  waveform) : pointeur-seul, aucune action Enter à promettre ; le chemin
  clavier reste les raccourcis transport. Seek au `pointerUp` bouton 0.
- **Tests** : 2 specs composant (`stem-lanes.spec` — seek au ratio cliqué,
  curseur unique apparition/effacement) + 1 acceptation shell
  (`workstation-shell.stems` — clic à 30 % d'une timeline 10 s → transport
  calé à 3 s via le stem engine). `renderShell` expose désormais `stemEngine`.
- Gate **verte** (typecheck, biome, Sheriff, coverage, knip, jscpd) +
  **react-doctor 0 issue**.

## Not done / remaining
- Reste du Lot AM : **AM.2** (fader console — double-clic 0 dB, Shift/molette
  pas 0,5 dB, lecture dB éditable — idiome « retour neutre » partagé avec AL.3
  déjà livré), **AM.3** (confiance visible — chip/pastille %), **AM.4** (EQ
  lisible + Hz par slider + mini-mètre par stem alimenté par le tap analyser,
  session-only, **pas** de persistance — arbitrage T.8 respecté).

## Decisions
- **Pas de timecode sur le survol des lanes** : le trait seul suffit à la
  cohérence visuelle ; la waveform principale porte déjà le timecode au survol,
  et empiler une étiquette par lane courte encombrerait. « hover-line
  cohérente » = même trait, pas même label.
- **Clic-lane = seek simple** (validé avec l'utilisateur) : ne touche jamais la
  région A/B armée — cohérent avec le clic simple sur la waveform principale.
- **Seek au `pointerUp`** (pas `pointerDown`) : geste click-like ; pas de
  drag-select sur les lanes (la boucle reste sur la waveform).
- **Aucun changement core** (@app/core) : slice purement adaptateur web →
  Stryker inchangé, non rejoué.

## Files
- `packages/web/src/app/mixer/stem-lanes.tsx` — surface seek/hover + props
  `onSeekRatio`/`durationSeconds`.
- `packages/web/src/app/mixer/stem-lanes.module.css` — `.group`/`.surface`/
  `.hover`.
- `packages/web/src/app/waveform/hover-cursor.module.css` — **nouveau** : le
  trait de curseur 1 px extrait en primitive partagée (`composes`) par la
  waveform et les lanes → une seule source de vérité (élimine le clone jscpd).
- `packages/web/src/app/workstation-shell/shell-stage.tsx` — câblage.
- `packages/web/src/app/workstation-shell/shell-test-kit.tsx` — `renderShell`
  renvoie `stemEngine`.
- Specs : `stem-lanes.spec.tsx`, `workstation-shell.stems.spec.tsx`.
