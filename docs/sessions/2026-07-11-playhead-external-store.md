# Session — 2026-07-11 — playhead-external-store (L.1)

## Done
- **L.1 de la [roadmap v3](../roadmap-excellence-3.md)** : la position de
  lecture était dispatchée dans le reducer du shell à chaque
  requestAnimationFrame — tout l'atelier se réconciliait 60–120 fois/s pendant
  la lecture. Elle vit désormais **hors de l'état React** :
  - Primitive `createExternalValue` / `useExternalValue`
    ([lib/external-value.ts](../../packages/web/src/lib/external-value.ts)) :
    store abonnable + `useSyncExternalStore` avec **snapshot dérivé** — un
    consommateur ne re-rend que quand SA projection change (`Object.is`).
  - `useTransportEngines` : le tick alimente le store, plus le reducer ; le
    `dispatch` intercepte `seek`/`load` pour garder les deux vues du playhead
    en accord (le hand-off de moteur lit `position.get()`) ; l'arrêt en fin de
    piste (ex-job du reducer `tick`) vit dans le listener.
  - Consommateurs par granularité : **timecode** = snapshot `formatTimecode`
    (1 rendu/s, dans TransportBar), **read-out tempo** = `tempoAt` arrondi
    (1 rendu par segment traversé), **mesure jouée** = `measureIndexAt`
    (1 rendu par mesure, dans ShellMain), **playhead + scroll zoomé** =
    abonnement **impératif** dans ZoomStage (0 rendu React — style/scroll
    directs), **lectures événementielles** (seek clavier, marqueur, count-in,
    caler la phase) = `position.get()`.
- **Mesuré en réel** (hook React DevTools, projet 5 stems + grille affichée) :
  **8 commits React en 5 s de lecture** (~1,6/s, le timecode) contre
  ~60–120/s avant — ÷40 à ÷75.
- Browser-vérifié : timecode avance, playhead fluide, surlignage de mesure,
  wrap de boucle et count-in couverts par les 954 specs (mêmes comportements,
  nouveau chemin).
- 2 faux positifs react-doctor supprimés de façon ciblée (abonnement à un
  store externe ≠ logique d'événement) — découverte au passage : la config
  `doctor.config.json` à la racine n'était **jamais lue** (react-doctor
  résout sa racine à `packages/web`) ; la config vit désormais dans
  [packages/web/doctor.config.json](../../packages/web/doctor.config.json)
  (versionnée), la racine restaurée telle quelle.

## Not done / remaining
- L.2 (recadrage du ZoomStage « par pages » + scroll manuel non confisqué) :
  le coût par frame a disparu (plus de layout forcé par re-render), mais le
  recentrage systématique pendant la lecture zoomée reste — comportement
  inchangé volontairement, c'est la slice L.2.
- `TransportState.positionSeconds` (core) existe toujours et ne reflète plus
  que les seeks — les specs du hook documentent le nouveau contrat ; à
  nettoyer si un futur lot touche le domaine transport.

## Decisions
- Store générique dans `packages/web/src/lib` (pas dans le core) : c'est de la
  plomberie React/adaptateur, pas du domaine.
- Snapshots dérivés plutôt que throttling : la granularité de re-rendu est
  définie par ce que chaque consommateur AFFICHE — pas de fréquence arbitraire.

## Gate status
- typecheck: ✅ (gate exit 0)
- tests (with coverage): ✅ 954 web/core (+9)
- mutation (Stryker): non lancé — **aucun fichier de `@app/core` touché**
  (slice 100 % web).
- biome / sheriff / knip / jscpd / react-doctor / impeccable: ✅
- i18n : aucune chaîne modifiée.

## State to resume from
- **Single next action** : ouvrir la PR de `perf/playhead-external-store`,
  la merger, puis L.2 (ZoomStage par pages) ou L.3 (mémoire stems) selon la
  roadmap.
- Gotchas : les specs du shell pilotent le fake engine par `emit()` — ils
  passent tels quels (le store notifie sous `act`) ; le probe de commits
  React DevTools nécessite l'extension (mesure faite dans le Chrome de dev).
