# Session — 2026-07-16 — V.1 : upload d'analyse mono + 24 kHz

## Done
- **Core** : `downmixToMono(channels)` pur (promotion du `mixToMono` privé de
  `track.ts`, TDD + property test fast-check) — rejette la liste vide **et**
  les canaux de longueurs inégales (un canal plus court replierait des NaN
  encodés en silence) ; `buildTrack` lui délègue sa garde. Export public,
  enregistré dans `application/README.md` (famille codec WAV pur).
- **Web** : `encode-analysis-wav-memo.ts` — `encodeAnalysisWav(audio,
  resample)` (seam testable, resampler injectable ou `null`) +
  `encodeAnalysisWavMemo(audio)` (memo WeakMap par `DecodedAudio`, resampler
  runtime résolu une fois, éviction du cache sur rejet). Politique : fold mono
  (core) → 24 kHz si le taux source est supérieur ; **le rééchantillonnage ne
  fait jamais échouer une détection** (audio zéro-frame jamais rendu, échec de
  render → repli au taux source). `resample-mono.ts` = humble object
  OfflineAudioContext (exclu de la couverture, vérifié navigateur), réutilise
  `audioBufferFrom` (élargi à `BaseAudioContext`).
- **Branchement** : `postWavForJson` encode via le memo d'analyse → `/tempo`,
  `/chords`, `/structure` uploadent le WAV mono 24 kHz ; `/separate` garde
  `encodeWavMemo` plein débit (ses stems reviennent au player).
- **Mesure (The Logical Song, 4:09)** : 44 042 028 → **11 984 258 octets
  (3,67×)** ; résultats **identiques octet pour octet** au plein débit sur
  `/tempo` (120.0 BPM, 495 beats, mêmes instants) et `/chords` (182/182
  spans). Browser-verify sur 5173 avant **et** après le refactor de revue
  (content-length et BPM inchangés).
- **Revue 8 angles → 3 vérificateurs adversariaux** : 8 constats fixés
  (canaux inégaux, zéro-frame NotSupportedError confirmé, seam
  default-param/`undefined`, réutilisation `audioBufferFrom`, spec tempo
  découplé de la politique d'encodage via l'identité du memo, garde dupliquée
  `buildTrack`, README, littéraux 24000 dans les specs) ; 3 réfutés documentés
  (hi-res >96 kHz — spec-incohérent ; double resample accords — mesuré sans
  effet, bande CQT ≤ 2,1 kHz ; parité float32 — sans effet observable) ;
  différés/acceptés : abort observé au fetch seulement (render inarrêtable +
  memo pré-chauffé — commenté), downmix dupliqué import/détection (memoïser
  épinglerait ~42 MB), pré-chauffe `/separate` perdue (by design).
- **Outillage** : reporter Stryker `json` ajouté (`reports/mutation/
  mutation.json`) — fini le parsing du HTML, `jq` interroge par fichier.

## Not done / remaining
- V.2 (décharger le moteur mono-piste après hand-off) et V.3 (warm des
  modèles au démarrage du serveur local) restent ouverts.
- La mesure Modal réelle (structure offloadée, réseau montant residentiel)
  n'a pas été refaite — la réduction 3,67× du payload est établie en local ;
  le gain perçu se vérifiera à la prochaine session Modal.

## Decisions
- Le WAV d'analyse est un **artefact d'adapter** (politique de transport), pas
  un concept du core : seul le fold mono est domaine ; taux 24 kHz et
  OfflineAudioContext vivent côté web.
- Deux memos d'encodage distincts assumés : plein débit pour `/separate`
  (fidélité), mono 24 kHz pour l'analyse (poids) — le clic « Séparer » paye
  désormais son propre encodage à froid (trade-off accepté).
- Le rééchantillonnage est une optimisation d'upload : tout échec dégrade au
  mono taux source au lieu d'échouer la détection.

## Gate status
- typecheck : ✅
- tests (with coverage) : ✅ 1521 tests, 125 fichiers (96,75 % statements)
- mutation (Stryker, local, core touché) : ✅ **93,93 %** — `track.ts` 100 %,
  `downmix.ts` 21 killed / 1 survivant (mutant équivalent `<`→`<=` : écriture
  hors bornes d'un Float32Array silencieusement ignorée)
- biome / sheriff / knip / jscpd : ✅ (7 clones pré-existants inchangés)

## State to resume from
- **Single next action** : ouvrir la PR de `feat/v1-analysis-upload` (2 commits
  + ce rapport), merger, puis attaquer V.2 (`unload()` sur `PlaybackEngine`
  au hand-off stems, motif heap-snapshot de L.3).
- Gotchas : le spec tempo épingle le corps POSTé par **identité** avec
  `await encodeAnalysisWavMemo(MIX)` — si un futur test réutilise le même
  objet `MIX` avec une autre politique attendue, le memo répondra en cache ;
  `reports/mutation/mutation.json` n'existe qu'après un run local.
