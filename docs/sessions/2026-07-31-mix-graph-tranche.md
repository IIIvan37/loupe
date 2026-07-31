# Session — 2026-07-31 — interface étroite de session : la tranche `StemMixGraph` (DIP)

## Done

- **Deuxième tranche disjointe de `StemPlaybackEngine`** (la première,
  `StemAudioSource`, est livrée par la PR #307) : le **graphe de mix** est nommé
  au seam — `StemMixGraph`, **5 membres sur 15** (`load`, `addStem`,
  `removeStem`, `setGain`, `setStemFilter?`), façonné par son unique
  consommateur, `useMixer`.
- **`useMixer` ne nomme plus le port core** : son paramètre injecté est un
  `StemMixGraph`, et il lit le graphe seaté via `useStemMixGraph()`. Le mixer ne
  voit donc plus le transport (il ne démarre jamais la lecture) ni la custody
  des PCM (c'est `StemAudioSource`). `requireStemEngine` → `requireMixGraph` :
  le seam reste un lecteur, c'est le consommateur qui décide qu'un graphe absent
  est une erreur de programmation (le mix a UN graphe, jamais un privé).
- **Spec rouge d'abord** (`audio-session.spec.tsx`) : `useStemMixGraph()` pilote
  le graphe seaté à travers l'interface étroite, et vaut `undefined` tant
  qu'aucun moteur n'est posé.
- **Preuve côté consommateur** (`use-mixer.spec.tsx`) : `useMixer` monté sur un
  objet qui n'offre QUE les cinq membres charge, coupe une piste et rend ses
  canaux — si le mixer retouchait `play` ou `stemAudio`, la spec casserait.
- **Aucun membre n'est extrait**, comme pour la tranche précédente : c'est
  l'objet moteur qui est rendu, narrowé ; `use-stem-stack` continue de seater le
  moteur entier (il en crée le singleton, et le transport en a besoin).

## Not done / remaining

- **La troisième tranche : le transport** (`play`/`pause`/`seekTo`/
  `setTimeRatio`/`setPitchSemitones`/`onPositionChange`/`spectrum`, consommé par
  `use-transport-engines`). C'est la plus intéressante : elle est **commune à
  `PlaybackEngine` et `StemPlaybackEngine`**, ce qui explique pourquoi
  `use-transport-engines` peut déjà les échanger — l'interface consommateur
  existe de fait, sans nom.
- **7 props `ReturnType`** inchangées (deps d'orchestrateurs du shell) — l'autre
  chantier restant du cliquet.

## Decisions

- **Le seam déclare, le consommateur exige.** `useStemMixGraph()` rend
  `StemMixGraph | undefined` comme `useStemAudio()` : la politique du « graphe
  absent » (throw pour le mixer, `undefined` toléré pour la lecture des PCM)
  appartient au consommateur, pas au seam. Deux tranches, deux politiques, un
  seul lecteur.
- **La tranche se prouve à l'exécution, pas seulement au type** : une spec qui
  monte le mixer sur un objet à cinq membres est le garde-fou qui survit à un
  futur `engine.play()` glissé dans le hook (le type seul ne protège que le
  chemin injecté).
- Module watch : aucun signal côté core (aucune source core touchée).

## Gate status

- `pnpm gate` ✅ complet (tampon `78ad30fe`) : typecheck ✅ · biome ✅ ·
  sheriff ✅ · design/react ✅ · tokens/i18n ✅ · knip ✅ · jscpd ✅.
- tests : ✅ suite complète verte (+3 specs), couverture 96,83 % statements /
  92,3 % branches.
- mutation : **sans objet** — `mutation:diff` confirme qu'aucune source core
  n'est touchée (web uniquement).
- sonar : à relire sur la PR.

## State to resume from

- **Single next action** : la **tranche transport**, la dernière des trois —
  nommer au seam ce que `use-transport-engines` consomme déjà des deux moteurs
  indifféremment, et vérifier au passage que ce nom recouvre bien
  `PlaybackEngine` autant que `StemPlaybackEngine` (c'est l'hypothèse à tester,
  pas un acquis).
- Gotchas :
  - `useStemMixGraph()` rend le moteur narrowé, pas des méthodes extraites — ne
    pas « simplifier » en déstructurant, ce serait perdre la liaison `this` de
    l'adaptateur.
  - `use-stem-stack` garde le moteur entier : il crée le singleton et le seate ;
    seuls les consommateurs voient moins.
  - Le seam n'est pas un annuaire de hooks : un hook par tranche **nommée**, pas
    par entrée.
