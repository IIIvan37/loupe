# Session — 2026-07-16 — v2-engine-unload

## Done

- **V.2 (roadmap v4)** : le moteur mono-piste est déchargé au hand-off stems.
  Résidu consigné de L.3 : après le seat automatique du métronome (chemin par
  défaut de chaque import), l'AudioBuffer du moteur mono-piste (~85 MB float32
  / 4 min) restait résident à jamais.
- **Core** : `unload()` ajouté au port `PlaybackEngine`
  (`packages/core/src/application/ports.ts`) — libère l'audio chargé, le
  moteur devient inerte (play/seek no-ops) en gardant ses réglages transport ;
  un `load` ultérieur le réarme. Changement d'interface seul (aucun code
  exécutable core).
- **Hook** (`use-transport-engines.ts`, TDD — 11 tests dédiés) : le hand-off
  vers le mix appelle `playback.unload()` ; le hand-back **recharge
  paresseusement** depuis le PCM gardé (`trackAudio`, valeur simple lue via
  `useLatest`, jamais une dep de l'effet) puis remet le moteur à l'état VIVANT
  de la session : seek sur `position.get()` (pas le snapshot du hand-back) et
  reprise de la lecture si le transport est passé playing pendant le reload.
  Gardes anti-course : PCM changé (nouvel import) ou re-hand-off en vol →
  restore sauté.
- **Adapter** (`web-audio-playback.ts`, humble object) : `unload()` (stop
  source + drop buffer, sans émettre — le playhead partagé appartient à
  l'appelant) et garde **last-load-wins** (`loadId`) couvrant `load` ET
  `unload` : un reload en vol supplanté ne re-matérialise jamais le buffer.
- **Browser-verify A/B (motif L.3)** : parcours identique (import The Logical
  Song 4:09 → tempo → seat métronome) sur `main` et sur la branche, heap
  snapshot Chrome : **7 AudioBuffers sur main, 6 sur V.2** — le buffer
  mono-piste (≈ 88 MB float32) est bien libéré. Lecture OK après hand-off
  (le gel apparent du playhead en onglet non focalisé = throttling rAF,
  pas un bug). NB : `usedJSHeapSize` est aveugle ici (les données
  d'AudioBuffer vivent hors heap JS) — compter les AudioBuffers du snapshot.
- **Revue 8 angles** → 5 fixés (loadId dans unload ; seek vivant au resolve ;
  reprise play post-reload ; `trackAudio` valeur simple — le getter ajoutait
  une double indirection `useLatest` avec un commentaire faux ; branche else
  du hand-back sans PCM supprimée — contractuellement morte après unload),
  4 écartés documentés (`.catch` gardé : le port autorise un load rejetant,
  cf. `loadTrack`, mais l'adapter réel ne rejette jamais aujourd'hui ;
  extraction du token partagé avec `loadToken` du stem engine : attendre un
  3e moteur ; fake moteur partagé inter-packages : impossible core↔web ;
  memo `WeakMap<DecodedAudio, AudioBuffer>` au décodeur — voir ci-dessous).

## Not done / remaining

- **Piste plus profonde (différé, candidate roadmap)** : le décodeur retient
  déjà le storage du PCM via `loadedAudio` (vues `getChannelData`), et chaque
  `load()` du moteur en fait une **seconde** copie AudioBuffer (~85 MB) —
  en mémoïsant l'AudioBuffer décodé (WeakMap par `DecodedAudio`), load/unload
  deviendraient gratuits et le mode piste perdrait ~85 MB de plus. Touche
  décodeur + adapter (deux humble objects) — hors périmètre V.2.
- `encodeWavMemo` (~40 MB) + `encodeAnalysisWavMemo` (~11 MB) restent épinglés
  par `loadedAudio` après usage — trade-off délibéré de L.4/V.1, à re-peser
  seulement si la pression mémoire mord.
- Le hand-back réel n'est pas atteignable par l'UI courante (aucun retrait de
  stem) — il ne se produit qu'aux transitions import/restore ; couvert par les
  tests unitaires.

## Decisions

- `unload()` vit sur le port `PlaybackEngine` (pas d'équivalent
  `StemPlaybackEngine` : le mix est le custodian des PCM stems, L.3 — pas de
  poids mort symétrique).
- La politique unload/reload appartient au hand-off de `useTransportEngines`
  (l'unique endroit qui sait quel moteur possède le transport) ; `use-player`
  ne fait que passer `loadedAudio`.
- Après un reload de hand-back, le moteur reprend l'état **vivant** (playhead
  du store, play si demandé pendant le reload) — le snapshot du hand-back
  n'est qu'un point de départ.

## Gate status

- typecheck : ✅ (piégé une fois par `exactOptionalPropertyTypes` sur le Props
  du spec — corrigé)
- tests (with coverage) : ✅ **1532 tests** (+11 hand-off/unload, −1 branche
  morte vs main à 1521) — via pre-commit gate (2 commits) + `pnpm gate` (un
  premier run a montré le flake de coverage sous contention documenté en Q.3 ;
  reruns verts)
- mutation (Stryker) : **skippé** — le seul changement `@app/core` est un
  membre d'interface (zéro mutant possible) ; la logique nouvelle est web
  (hook testé + humble object)
- biome / sheriff / knip / jscpd : ✅

## State to resume from

- **Single next action** : ouvrir la PR de `feat/v2-engine-unload` (2 commits :
  feature + durcissement revue) puis merger ; ensuite **V.3** (warm des
  modèles au démarrage du serveur local, 🟢) ou **V.4** (playhead en
  `transform`, 🟢) selon l'envie — W.3–W.5 restent aussi.
- Gotchas : l'adapter est un humble object non testé en jsdom — toute
  évolution de `load()`/`unload()` doit préserver le contrat last-load-wins
  (`loadId` bumpé par les DEUX) ; le browser-verify heap se fait en comptant
  les AudioBuffers d'un heap snapshot, pas via `usedJSHeapSize`.
