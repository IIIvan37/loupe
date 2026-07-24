# ADR 0009 — Time-stretch via SoundTouch (MPL-2.0), pas Rubber Band (GPL)

- **Statut** : accepté
- **Date** : 2026-06-28 (décision révisée en pleine slice, tracée dans
  [jalon1-timestretch](../sessions/2026-06-28-jalon1-timestretch.md) et
  [STATUS](../STATUS.md) ; rédigé a posteriori le 2026-07-24, lot TS.3)

## Contexte

Le kickoff du jalon 1 avait verrouillé **Rubber Band** comme moteur de
time-stretch — le meilleur en qualité — avec un avertissement explicite : sa
licence **GPL** aurait imposé de publier le produit en GPL, ou d'acheter la
licence commerciale ([jalon-1-plan.md](../jalon-1-plan.md), « à reconfirmer
avant la Slice 3 »).

À la Slice 3, la vérification en navigateur a tranché : l'unique wrapper web
(`rubberband-web`) **crashe au changement de pitch en cours de lecture**
(`ArrayBuffer` WASM détaché) et n'est pas maintenu. Le verrou du kickoff est
tombé sur un fait technique avant même l'arbitrage de licence.

## Décision

- **Moteur : SoundTouch** (`@soundtouchjs/audio-worklet`, **MPL-2.0**) — pur
  JS (pas de WASM), maintenu, stable au changement de pitch live. **La
  contrainte GPL est levée** : le produit peut être publié sous n'importe
  quelle licence.
- **Architecture du stretch** : le tempo passe par le `playbackRate` de la
  source (un worklet temps réel nourri par une source temps réel ne peut pas
  étirer sans under-run) ; le worklet ne fait que la transposition à tempo
  constant (son `setTempo` reste à 1).
- L'asset worklet est vendoré (`packages/web/public/soundtouch-processor.js`) ;
  la lib est importée **dynamiquement** (`import type` + `import()`) pour
  rester hors du graphe vitest/node.

## Conséquences

- Aucune obligation GPL : le choix de licence du produit (fermé, commercial,
  ouvert) reste entièrement libre — c'était l'enjeu stratégique de la
  décision, réglé par un constat technique.
- Qualité légèrement sous Rubber Band sur les stretchs extrêmes — acceptable
  pour un player de transcription ; les réglages proches de 1.0 sonnent le
  mieux.
- L'upgrade de `@soundtouchjs/audio-worklet` demande de re-copier l'asset
  vendoré depuis `node_modules` — friction connue, tracée dans la session.
- Revenir à Rubber Band (wrapper réparé, ou licence commerciale achetée)
  rouvrirait la question GPL : ce serait un nouvel ADR qui remplace
  celui-ci, pas un simple swap de dépendance.

## Alternatives envisagées

- **Rubber Band (le verrou initial).** Meilleure qualité sur les stretchs
  extrêmes, mais wrapper web unique, crashant et non maintenu — et
  l'obligation GPL/licence payante en prime. Rejeté sur pièces, en
  navigateur.
- **Étirer le tempo dans le worklet** (son `setTempo`). Under-runs
  garantis avec une source temps réel ; c'est la raison du partage
  tempo=`playbackRate` / pitch=worklet. Rejeté.
- **Import statique du worklet.** Traînait la classe worklet (et `tone`, du
  temps de l'essai Rubber Band) dans le graphe de modules vitest/node et
  cassait la suite. Rejeté au profit de l'import dynamique confiné au chemin
  navigateur.
