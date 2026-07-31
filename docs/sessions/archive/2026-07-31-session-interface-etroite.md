# Session — 2026-07-31 — interface étroite de session : l'inventaire, puis la tranche `stemAudio` (DIP)

## Done

- **Inventaire des 12 entrées du seam de session** (la feuille annoncée par
  l'[ADR 0012](../adr/0012-graphe-de-modules-web.md) : « le seam déclare,
  l'adaptateur implémente »). Pour chaque entrée, la tranche réellement
  consommée :

  | Entrée | Port (membres) | Tranche consommée |
  |---|---|---|
  | `decoder`, `metadataReader`, `separator`, `tempoDetector`, `chordDetector`, `structureDetector`, `trackSource` | 1 membre | **tout** — déjà étroit |
  | `projectStores` (`ProjectDeps`) | 2 | tout (repassé au core) |
  | `countInPlayer` | 1 | déjà déclaré au seam ✓ |
  | `player` (`PlayerHandle`) | 7, déjà au seam | 3 à 5 selon le consommateur |
  | `engine` (`PlaybackEngine`) | 9 | quasi tout (`use-player` + `use-transport-engines`) |
  | **`stemEngine` (`StemPlaybackEngine`)** | **15** | **3 tranches disjointes** : mixer (5) · transport (7) · **séparation (1)** |

- **Le seul port gras est `StemPlaybackEngine`** : huit entrées sur douze sont
  des interfaces à un ou deux membres — les segréguer serait du bruit.
- **Première tranche livrée** (branche `refactor/session-narrow-stem-audio`,
  PR #307 ouverte) : `StemAudioSource` — *un* membre sur quinze — est déclaré au
  seam, façonné par son consommateur, et `useStemAudio()` le sert.
  `useSeparation` ne nomme plus `StemPlaybackEngine` : il lit les PCM par
  l'interface étroite, l'adaptateur la satisfait structurellement (le même
  motif que `CountInPlayer`).
- **Spec rouge d'abord** (`audio-session.spec.tsx`) : `useStemAudio()` relit un
  stem chargé à travers la custody, et vaut `undefined` tant qu'aucun moteur
  n'est posé (pas de stems, rien à relire).
- **Aucun membre n'est extrait** : c'est l'objet moteur qui est rendu, narrowé
  — un adaptateur dont le lecteur fermerait sur `this` continue de marcher.

## Not done / remaining

- **Les deux autres tranches de `StemPlaybackEngine`** : le graphe de mix
  (`load`/`addStem`/`removeStem`/`setGain`/`setStemFilter`, consommé par
  `useMixer`) et le transport (`play`/`pause`/`seekTo`/`setTimeRatio`/
  `setPitchSemitones`/`onPositionChange`/`spectrum`, consommé par
  `use-transport-engines`, qui choisit déjà l'un OU l'autre moteur : c'est une
  interface consommateur qui existe de fait, sans nom).
- **7 props `ReturnType`** inchangées (deps d'orchestrateurs du shell) — l'autre
  chantier restant du cliquet.

## Decisions

- **Critère de segrégation, mesuré et non intuitif** : une entrée de session ne
  gagne une interface étroite que si un consommateur utilise une *tranche* d'un
  port gras. Sur douze entrées, une seule remplit le critère. Le corollaire
  vaut d'être écrit : les ports du core sont déjà des interfaces définies côté
  consommateur (le hexagone) — la DIP du seam n'est pas une couche de plus par
  défaut, c'est un remède ciblé à un port qui sert trois consommateurs
  différents.
- **Ce qui narrow est le regard, pas l'objet** : le seam continue de porter le
  moteur singleton entier (le mixer et le transport en ont besoin) ; seuls les
  consommateurs voient moins. Aucun changement de runtime, aucune indirection
  ajoutée.
- Module watch : aucun signal côté core (aucune source core touchée).

## Gate status

- `pnpm gate` ✅ complet (tampon `4009a387`) : typecheck ✅ · biome ✅ ·
  sheriff ✅ · design/react ✅ · tokens/i18n ✅ · knip ✅ · jscpd ✅.
- tests : ✅ suite complète verte (+2 specs seam), couverture 96,83 %
  statements / 92,33 % branches.
- mutation : **sans objet** — aucune source core touchée (web uniquement).
- sonar : ✅ quality gate OK sur la PR #307 — 0 issue ouverte, 0 hotspot.

## State to resume from

- **Single next action** : la deuxième tranche du même port — nommer le
  **graphe de mix** au seam (`useMixer` n'a rien à faire du transport ni des
  PCM), puis la tranche transport, qui est la plus intéressante : elle est
  commune à `PlaybackEngine` et `StemPlaybackEngine`, ce qui explique pourquoi
  `use-transport-engines` peut déjà les échanger.
- Gotchas :
  - `useStemAudio()` rend le moteur narrowé, pas une méthode extraite — ne pas
    « simplifier » en `session.stemEngine?.stemAudio`, ce serait défaire la
    tranche ET perdre la garantie de liaison.
  - `useSeparation` garde son paramètre `pcmOf` : `useStemStack` vit AU-DESSUS
    du provider enrichi et doit continuer de passer le lecteur explicitement.
  - Le seam n'est pas devenu un annuaire de hooks : `useStemAudio` existe parce
    qu'une tranche est nommée, pas pour envelopper chaque entrée.
