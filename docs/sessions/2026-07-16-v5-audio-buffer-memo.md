# Session — 2026-07-16 — v5-audio-buffer-memo

## Done

- **V.5 (roadmap v4, exploré puis livré le même jour)** : les moteurs jouent
  le **buffer de décodage lui-même** au lieu d'en recopier le PCM.
  `audio-buffer-memo.ts` (`WeakMap<DecodedAudio, AudioBuffer>`, modèle
  `encode-wav-memo`) : le décodeur enregistre la paire (ses channels SONT des
  vues zéro-copie du buffer), `audioBufferFrom` sert le buffer partagé sur un
  hit et ne copie qu'en miss. TDD : 4 tests (round-trip, miss, clé par
  identité, hit court-circuite le contexte — le spec appelle
  `audioBufferFrom` avec un contexte vide qui jetterait à la moindre copie).
- **Fail-safe cross-navigateur (fix de revue, le constat majeur)** : le spec
  Web Audio (« acquire the contents ») autorise un UA à **détacher** les vues
  `getChannelData` quand le buffer est joué — `loadedAudio` serait zéroé
  (analyses silencieuses, save/export corrompus). Probe one-shot
  (`sharingKeepsViewsValid`, render offline de 2 frames) : si l'UA détache,
  le décodeur n'enregistre jamais → chemin copie pré-V.5 intact. Chrome 150 :
  probe verte (storage partagé — vérifié aussi par mutation visible à travers
  la vue après lecture).
- **Browser-verify** (compteur temporaire dans `recallAudioBuffer`, retiré
  avant commit) : import The Logical Song → seat métronome = **2 hits**
  (load du moteur piste + stem « Piste ») — les deux copies ~88 MB évitées ;
  lecture OK à travers le buffer partagé ; détection d'accords **après**
  lecture → key of Cm (juste) + grille 108 mesures — vues intactes.
- **Leçon de mesure** : la copie `createBuffer` du moteur vit côté audio
  renderer — invisible du heap JS (ni wrappers ni `JSArrayBufferData`, qui ne
  matérialisent qu'au `getChannelData`). Preuve par hits du memo, pas par
  snapshot.
- **Réactualisation V.2** : avec le partage, `unload()` ne libère plus ~85 MB
  (le storage est épinglé par `loadedAudio`) — sa reclamation réelle ne
  subsiste que sur le chemin fallback (UA détachant) ; les deux commentaires
  (`unload`, hand-off) réécrits. La machinerie V.2 reste correcte et utile
  (source stoppée, moteur inerte, fallback).
- Revue 3 finders → 3 fixés (probe, contrat READ-ONLY documenté sur
  `audioBufferFrom`, commentaires V.2), 4 écartés documentés : copie interne
  retenue post-play (réfuté sur Chrome — la mutation via la vue est visible,
  donc storage partagé sans copie) ; race `addStem` à froid → **préexistante
  sur `main`** (deux sources pour un même stem si play pendant
  l'enregistrement du worklet — consignée en veille) ; enregistrement
  décodeur hors coverage (humble object, le spec test épingle le comportement
  bout-en-bout) ; extraction `recallOr(build)` (le test existant garde déjà
  la branche).

## Not done / remaining

- Race `addStem`/`play` à froid (préexistante) : deux sources orphelines
  possibles pendant la fenêtre d'enregistrement du worklet — à corriger si
  ça mord (fenêtre de ~100–500 ms au premier chargement seulement).
- La probe n'a été exercée que sur Chrome (seul UA piloté) ; sur un UA
  détachant elle désactive le partage par construction, non vérifié en vrai.

## Decisions

- Le partage est **opt-in par preuve** : jamais enregistré tant que la probe
  n'a pas montré que jouer un buffer préserve les vues. Un UA conforme-strict
  garde le comportement pré-V.5 (copies) sans aucune autre branche.
- Buffer rendu par `audioBufferFrom` = **lecture seule** par contrat (même
  convention que les vues `stemAudio` de L.3).
- Le memo n'est alimenté que par le décodeur (ses channels sont des vues du
  buffer — une seule source de vérité) ; les DecodedAudio construits
  (resample mono, count-in, stems séparés) continuent de copier.

## Gate status

- typecheck : ✅
- tests (with coverage) : ✅ **1536 tests** (+4) — pre-commit gate + `pnpm
  gate` plein
- mutation (Stryker) : **skippé** — core intouché (tout le diff est web)
- biome / sheriff / knip / jscpd : ✅

## State to resume from

- **Single next action** : ouvrir la PR de `feat/v5-audio-buffer-memo` puis
  merger ; ensuite V.3 (warm des modèles au démarrage local) ou V.4
  (playhead en `transform`) ; W.3–W.5 restent.
- Gotchas : ne jamais écrire dans un buffer rendu par `audioBufferFrom` ni
  dans des channels `DecodedAudio` ; toute évolution du décodeur doit garder
  `rememberAudioBuffer` derrière la probe ; la vérif mémoire de ce chemin se
  fait par hits du memo (instrumentation temporaire), pas par heap snapshot.
