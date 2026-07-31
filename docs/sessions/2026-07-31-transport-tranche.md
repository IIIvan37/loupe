# Session — 2026-07-31 — interface étroite de session : la tranche `PlaybackTransport` (DIP)

## Done

- **Troisième et dernière tranche disjointe de `StemPlaybackEngine`** :
  `PlaybackTransport`, **7 membres** (`play`, `pause`, `seekTo`, `setTimeRatio`,
  `setPitchSemitones`, `onPositionChange`, `spectrum?`), déclarée au seam et
  façonnée par ses deux consommateurs (`useTransportEngines`, `usePlayer`).
- **L'hypothèse de l'étape est vérifiée, et bornée** : ces 7 membres sont
  exactement la surface que `PlaybackEngine` et `StemPlaybackEngine` **partagent**
  — c'est la raison pour laquelle `use-transport-engines` peut déjà les échanger.
  Mais le moteur de piste porte **en plus** `load`/`unload` (le cycle de vie de la
  piste, piloté par le hand-off : `unload` à l'aller, `load` paresseux au retour)
  et doit rester un `PlaybackEngine` entier pour `loadTrack`. **Seul le côté stem
  se narrowe** : `session.engine` n'a jamais été un port gras (9 membres sur 9
  consommés).
- **`usePlayer` ne nomme plus le port core** : son paramètre injecté est un
  `PlaybackTransport`, lu au seam via `useStemTransport()`. Il pilote la lecture
  et lit le spectre ; charger un stem ou bouger un fader appartient au mixer, par
  sa propre tranche du même moteur.
- **`TransportControls` dérive du seam** (`Pick<PlaybackTransport, …>`) au lieu de
  `Pick<PlaybackEngine, …>` — une occurrence de moins du port core dans web.
- **Preuve à l'exécution des deux côtés** : les faux moteurs stem de
  `use-transport-engines.spec.ts` et `use-player.spec.tsx` n'offrent plus **que**
  les 7 membres. Toute la batterie de specs du hand-off, du wrap et de la rampe
  tourne dessus — un `engine.addStem()` glissé demain casserait, pas seulement le
  chemin injecté typé.
- **Spec rouge d'abord** au seam (`audio-session.spec.tsx`) : `useStemTransport()`
  pilote le moteur seaté, vaut `undefined` tant qu'aucun n'est posé, et une
  troisième spec monte un `PlaybackEngine` **et** un `StemPlaybackEngine` sous le
  même nom — la preuve que la tranche recouvre les deux moteurs.

## Not done / remaining

- **7 props `ReturnType<typeof useX>`** — l'autre chantier du cliquet : deps
  d'orchestrateurs du shell (`use-tempo-detection` ×2, `use-separate-and-load` ×2,
  `use-chord-chart-session`, `use-chart-with-structure`, `use-resume-gated-analysis`)
  à dériver des atomes plutôt qu'à typer par le retour d'un autre hook.
- **L'entrée `stemEngine` du seam reste `StemPlaybackEngine`** — c'est le siège du
  singleton, pas une consommation : `use-stem-stack` le crée, le provider le pose.
  Les trois hooks de lecture sont les seules vues qu'un consommateur obtient.

## Decisions

- **Les trois tranches PARTITIONNENT le port** : 1 (`StemAudioSource`) + 5
  (`StemMixGraph`) + 7 (`PlaybackTransport`) = **13**, chaque membre revendiqué
  exactement une fois, aucun partagé entre deux consommateurs. Le port gras était
  littéralement trois rôles dans une interface — le fait est écrit au seam.
- **Correction de fait** : le port compte **13 membres, pas 15** — les
  commentaires des tranches #307 et #308 l'affirmaient (« fifteen-member »),
  vérification faite sur `ports.ts` ils se trompaient. Corrigé aux trois endroits ;
  c'est ce qui a rendu la partition visible.
- **Le nom n'est pas préfixé `Stem`** — contrairement à `StemAudioSource` et
  `StemMixGraph` — précisément parce que la tranche n'est pas stem-spécifique.
  C'est le hook qui porte le stem (`useStemTransport()`, il lit l'entrée
  `stemEngine`), pas l'interface.
- Module watch : aucun signal côté core (aucune source core touchée).

## Gate status

- `pnpm gate` ✅ complet (tampon `738a6338`) : typecheck ✅ · biome ✅ ·
  sheriff ✅ · design/react ✅ · tokens/i18n ✅ · knip ✅ · jscpd ✅.
- tests : ✅ suite complète verte (+3 specs), couverture 96,83 % statements /
  92,33 % branches.
- mutation : **sans objet** — `mutation:diff` confirme qu'aucune source core
  n'est touchée (web uniquement).
- sonar : à relever sur la PR une fois l'analyse CI arrivée (~5 min après le push).
- CI : à vérifier sur la PR.

## State to resume from

- **Single next action** : les **7 props `ReturnType<typeof useX>`** — le dernier
  chantier du cliquet. Commencer par `use-tempo-detection` (2 des 7, et le plus
  gros consommateur), en dérivant les deps des atomes de feature (ADR 0010)
  plutôt qu'en typant par le retour d'un autre hook.
- Gotchas :
  - Les trois hooks du seam rendent le moteur **narrowé**, jamais des méthodes
    extraites — ne pas « simplifier » en déstructurant, ce serait perdre la
    liaison `this` de l'adaptateur. (Les *faux* moteurs des specs sont des objets
    plats : y extraire des membres est sans risque, et c'est ce qui permet de
    construire la vue à 7 membres.)
  - Le moteur de piste reste entier **par nécessité** : `loadTrack` (core) exige
    un `PlaybackEngine`, et le hand-off pilote son `unload`/`load`. Ne pas
    « finir le travail » en le narrowant aussi.
  - Le seam n'est pas un annuaire de hooks : un hook par tranche **nommée**, pas
    par entrée — la série s'arrête ici, les trois tranches couvrent tout le port.
