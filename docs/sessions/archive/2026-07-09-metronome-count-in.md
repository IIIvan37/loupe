# Session — 2026-07-09 — metronome-count-in (roadmap-excellence-2, Lot I.3)

## Done
- **Core pur — `buildCountIn`** ([metronome.ts](../../packages/core/src/domain/metronome.ts)) :
  une mesure de clics avant le départ — `CountIn { beats, durationSeconds }`,
  beats relatifs à 0 (downbeat en tête), intervalle `60 / (bpm × playbackRate)`
  pour que le décompte sonne au tempo **entendu** (une répétition à 50 % compte
  à 50 %). Pas de tempo ou de vitesse jouable ⇒ pas de décompte (`undefined`) ;
  mesure dégénérée ⇒ un temps. TDD (RED d'abord) + pin fast-check (n temps,
  un seul downbeat, durée = n·intervalle).
- **Hook web `useCountIn`** ([use-count-in.ts](../../packages/web/src/app/tempo/use-count-in.ts)) :
  enveloppe `togglePlayback` — au play, si la lane du clic est **audible**
  (métronome seated + mute/solo foldés via `effectiveGains`) et qu'un tempo
  existe, une mesure de clics part et le transport démarre à sa fin. Le bpm est
  le tempo **ressenti à la tête de lecture** (`tempoAt(buildTempoMap(grid))`,
  fallback bpm d'affiche). Un appui pendant le décompte l'abandonne (toujours
  en pause) ; pause immédiate en lecture ; tempo remplacé/reset (import,
  détection, ouverture projet) abandonne le décompte en attente (cleanup
  d'effet sur l'identité de l'analyse). 10 specs `renderHook` avec faux player.
- **Adaptateur one-shot** ([count-in-player.ts](../../packages/web/src/audio/count-in-player.ts)) :
  humble object Web Audio (exclu de la coverage comme ses pairs) — synthèse du
  clic via `synthesizeClickTrack` au sample-rate du contexte, lecture directe
  vers la destination (hors mix — il doit sonner avant les moteurs). Départ
  différé sur `onended` **avec minuteur mural de secours** (durée + 150 ms) :
  un `AudioContext` suspendu par l'autoplay ne joue jamais le buffer, le
  décompte doit dégrader en départ simple, pas pendre le transport — trouvé en
  vérification navigateur (clic synthétique sans activation utilisateur). Le
  fallback stoppe aussi la source (une reprise tardive du contexte cliquerait
  par-dessus la lecture). Annuler nettoie les deux chemins.
- **Câblage shell** : `useCountIn` fournit le `togglePlayback` du transport et
  des raccourcis clavier ; pendant le décompte le bouton lit « Pause »
  (`isPlaying || countingIn`) — l'appui l'annule, exactement ce qu'une pause
  veut dire à cet instant. Aucune nouvelle copy (pas de Lingui). Injection
  `countInPlayer` sur `WorkstationShell` pour les tests. 3 specs shell
  (décompte différé + face bouton, abandon au 2ᵉ appui, départ immédiat clic
  coupé — le défaut, le métronome seatant muted).
- **Vérification navigateur (Chrome réel, serveur local up)** : import d'un WAV
  de test, tempo détecté (58 BPM variable 10–58, 2 temps), clic dé-muté →
  play : bouton « Pause » immédiat, playhead gelé à 0:00 pendant ~3,4 s (= une
  mesure au tempo ressenti à 0 s de cette détection variable — pas le bpm
  d'affiche), puis départ et défilement régulier. Annulation : appui pendant le
  décompte → « Lecture », toujours 0:00, aucun départ tardif 4 s après.
  Console propre (404 favicon préexistants).

## User feedback rounds (2026-07-10, same branch)

Deux retours d'oreille de l'utilisateur ont reréglé le contrat musical :

1. **« Le 1er clic après le décompte n'est pas audible »** puis **« le curseur
   n'est pas forcément sur un temps / sur le premier temps »** — le vrai
   diagnostic est le sien : le décompte partait de l'instant brut du curseur,
   donc atterrissait hors grille, et comptait un faux « un ».
   `buildCountIn` prend désormais **la grille + le curseur**
   (`CountInInput`) : l'atterrissage est **calé sur le temps de la grille le
   plus proche** (retourné en `startSeconds`, le hook y seeke avant le premier
   clic), le tempo ressenti est lu à l'atterrissage, et **les accents suivent
   la phase de mesure du morceau** (atterrir sur le temps 2 sonne
   « 2 3 4 1 → départ », l'accent là où est le vrai « un » — downbeat cherché
   derrière, devant pour une levée, via `barOffsetAt`).
2. **« Deux clics rapprochés : on n'est pas calé »** — le clic d'atterrissage
   ajouté au premier tour doublait celui de la piste (décalés de la latence de
   démarrage du moteur → flam). Retiré : **l'atterrissage est le clic de la
   piste elle-même** (garanti présent par le calage), le buffer du décompte
   finit silencieux sur son dernier intervalle, et le départ différé est le
   minuteur mural à `durationSeconds` pile (`onended` = nettoyage/filet;
   contexte suspendu → source stoppée au tir pour qu'une reprise tardive ne
   clique pas par-dessus).

Stryker sur le nouveau code : premier run **avec des survivants réels** —
tie-break du temps le plus proche et recherche du downbeat sur grille
**irrégulière** (les grilles de test régulières rendaient
arrière/avant indiscernables) — tués par 4 cas ciblés (tie → temps
antérieur, downbeats irréguliers ×2, levées ×2). Restent 8 survivants
équivalents vérifiés à la main (gardes impossibles, congruences mod `bar`,
itérations hors-bornes ignorées). Gate re-green — **799 tests**; mutation
fraîche (run --force complet) **94,75 %**, `metronome.ts` 81,82 % (16
préexistants DSP + 8 équivalents count-in).

**Reste à l'oreille de l'utilisateur** : plus de flam à l'atterrissage, et le
léger retard du clic de piste (latence de démarrage moteur) acceptable.

## Not done / remaining
- Le décompte n'est pas annoncé aux lecteurs d'écran (pas de LiveStatus) — le
  canal est déjà audible par nature (des clics) ; à reconsidérer si un retour
  utilisateur le demande.
- Le volume du décompte ne suit pas le fader de la lane Métronome (plein
  niveau, accent downbeat) — jugé acceptable pour un pré-roll ; facile à
  ajouter (gain node au `dbToAmplitude` de la chaîne) si demandé.
- Écoute humaine du rendu sonore (clics audibles, enchaînement musical) — la
  machine a vérifié les timings, pas le son.

## Decisions
- **Le décompte suit le tempo entendu**, pas le tempo nominal : intervalle
  `60/(bpm × timeRatio)` avec le bpm ressenti à la tête de lecture — c'est le
  contrat musical d'un pré-roll (répétition lente = décompte lent).
- **« Métronome actif » = lane audible** (non muté, pas silencié par un solo),
  pas seulement seated — le métronome seatant muted par défaut, un play
  ordinaire reste immédiat tant que l'utilisateur n'a pas ouvert le clic.
- **Le one-shot ne passe pas par le mixer** : le pré-roll doit sonner avant que
  les moteurs ne tournent ; il vit dans son propre contexte, derrière un port
  web local (`CountInPlayer`) injectable.
- **Robustesse autoplay** : jamais faire dépendre l'avancement du transport du
  seul `onended` d'un contexte qui peut être suspendu — minuteur mural en
  secours, source stoppée au fallback.

## Gate status
- typecheck: ✅ (un accroc `exactOptionalPropertyTypes` sur le prop injecté, corrigé)
- tests (with coverage): ✅ **792 tests** (+20 : 7 core, 10 hook, 3 shell),
  coverage 96,07 % / 89 %
- mutation (Stryker, local, core touché): ✅ **95,09 %** global ; `buildCountIn`
  **0 survivant** ; les 16 survivants de `metronome.ts` (79,22 %) sont tous
  dans `synthesizeClickTrack` — code DSP préexistant intouché, mutants
  équivalents au niveau échantillon (bornes de buffer que les asserts de pics
  ne distinguent pas)
- biome / sheriff / knip / jscpd: ✅ / ✅ / ✅ / 7 clones (inchangé sur la session)

## State to resume from
- **Single next action** : ouvrir la PR de `feat/metronome-count-in`, puis
  **Lot J** (fond de panier : J.1 token `--danger`, J.2 états `:active`,
  J.3 quota disque blobs 🟠, J.4 dédup moteurs Web Audio, J.5 annulation des
  opérations longues) — le Lot I est complet avec ce lot.
- Gotchas : `count-in-player.ts` est exclu de la coverage vitest (humble
  object, liste dans [vitest.config.ts](../../vitest.config.ts)) ; le champ
  BPM du panneau a montré `invalid value 10` transitoire pendant la vérif
  navigateur (draft du champ sur une détection 10–58 BPM — préexistant I.2, à
  regarder si ça se reproduit sur une vraie piste).
