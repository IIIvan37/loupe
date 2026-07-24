# Session — 2026-07-18 — ad-chords-path

Lot AD de la [roadmap v6](../roadmap-excellence-6.md) — le parcours accords
dit vrai et ne gèle pas (branche `feat/ad-chords-path`).

## Done

- **AD.1 — narration + annulation honnêtes** : `useChordDetection` expose
  `phase: 'separating' | 'detecting'` ; l'item accords affiche « Séparation
  des pistes avant les accords… » pendant l'`ensureStems` (fini le mensonge
  « Détection des accords… » + cold-start du mauvais moteur), et son
  « Annuler » **annule aussi la séparation que le run a lancée**
  (`cancelSeparation` câblé depuis la surface séparation du shell) — un
  geste, plus deux.
- **AD.2 — DSP mesuré, peint, dégraissé** : le bloc synchrone (mix sans
  batterie + ligne de basse) court derrière une face busy **peinte**
  (`nextPaint`, R.4) et est mesuré (`performance.measure('chords-dsp')`) :
  **774 ms** sur la vraie piste 6 stems de 5 min. Côté core :
  `monoMixWithout` accumule directement dans la sortie (fini les 5 monos
  intermédiaires de ~42 MB), la FFT basse réutilise un scratch unique,
  `spectrumFromSamples` cache Hann + buffers par longueur. **Worker =
  follow-up documenté** si 774 ms une fois par session mordent encore.
- **AD.3 — memo V.1 restauré** : mix d'analyse + bassNotes cachés par
  (piste, ids stems, grille) — un re-run tend au détecteur la MÊME instance
  de mix, donc le memo WAV (WeakMap sur l'identité) re-hit.
  **Vérifié navigateur** : second run = 0 mesure DSP, ~5,2 s (réseau + BTC
  seulement).
- **Core (TDD)** : `bassNotePerMeasure` émet **une note par downbeat**
  (convention `chordLabelPerMeasure`, dernière barre étendue de la longueur
  de la précédente ; downbeat seul → fin du signal) — la dernière mesure
  d'un morceau peut enfin porter un slash ; fixture « note tardive »
  épingle l'étalement des 3 fenêtres ; doc `dominantBassClass` alignée sur
  le comportement réel (max par fenêtre, pas somme).
- **Fix de course trouvé en TDD** : le `runId` s'attribue en TÊTE de
  `detect()` — le nouveau yield pré-DSP ouvrait une fenêtre où un cancel ne
  supplantait pas le run (le commit posait quand même la grille).

## Not done / remaining

- Worker pour le bloc DSP (774 ms mesurés, 1×/session, derrière un busy
  peint) — à faire si l'usage le réclame.
- Le mono basse est re-downmixé alors que le mix le somme déjà — micro-opt
  non faite (le cache rend le point unique par session).

## Decisions

- Le cache DSP est clé sur (identité piste, ids stems, identité grille) —
  le PCM des stems est immuable pour une piste chargée.
- Chemin sans stems : synchrone jusqu'au détecteur (le contrat d'abort des
  specs — le signal tient le transfert dès le retour de `detect`).

## Gate status

- `pnpm gate` : **vert** (exit 0) — **1922 tests** (+8).
- mutation (Stryker, core touché) : **91,27 %** global (break 90).
  `analysis-mix` 84,8 % → +1 test (stem sans canaux) tue 2 survivants, les
  2 restants équivalents (`?? 0` absorbe la borne `<=`, même famille que le
  survivant documenté en 4a). `bass-line` 83,1 % / `spectrum` 88,1 % :
  familles DSP documentées (bornes flottantes, tie-breaks `>=`, positions
  de fenêtres sur fixtures mono-note — la fixture bi-fenêtre en tue une
  partie, le reste est de la même famille).

## State to resume from

- **Single next action** : Lot AF — AF.1 le relabel de structure préserve
  les directives de tête (`{key}` au moins ; `{form}` légitimement droppé
  tant que le refold n'existe pas — v2 = re-déduction d'instances) ; AF.2
  `headChord` coupe aussi au `/` (le slash est une observation de basse,
  pas un changement harmonique — le matching de forme ne doit plus le
  compter en désaccord).
- Gotchas : `performance.getEntriesByName('chords-dsp')` dans la console
  pour re-mesurer ; le cache DSP ne s'invalide PAS sur une re-séparation de
  la même piste (PCM identique, non-problème).
