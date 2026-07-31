# Session — 2026-07-30 — le sac loops en atomes, les régions le lisent elles-mêmes (ADR 0010)

## Done

- **Sixième feuille « sacs de feature en atomes »** (branche
  `refactor/loops-atoms`, PR #306 ouverte) : l'état de `useLoops` et
  `useLoopEditing` quitte les hooks à paramètres pour `loop-atoms.ts` —
  `loopLibraryAtom` (bibliothèque de boucles nommées) et `activeLoopIdAtom`
  (le loop sauvegardé dont vient la région active). Aucune logique dans les
  atomes : toutes les transitions restent dans les hooks, qui appellent le
  domaine du core (`addLoop`, `removeLoop`, `makeLoopRegion`,
  `snapLoopRegionToGrid`).
- **Diagnostic préalable (la question rituelle)** : pas d'adaptateur à état
  derrière — aucun port, aucune I/O, aucun jeton de run/abort. Donc atomes
  seuls (cas repères/tempo/zoom). La particularité était ailleurs : le bridge
  PILOTE le player ; il passe désormais par le `PlayerHandle` de session
  (ADR 0011), qui gagne `setLoopRegion` — la sémantique seat-and-re-arm et
  l'arrêt du ramp sur clear restent dans le player, pas dans la feature.
- **L'API du bridge passe en secondes** (la monnaie du domaine) : la
  conversion fractions→secondes appartient à `ShellStage`, qui lit déjà
  `transportAtom`. La durée sort du hook — et avec elle la dépendance qui
  aurait créé un cycle `loops → waveform` (l'arête `waveform → loops` du
  speed-trainer existe déjà, ADR 0012).
- **Spec rouge d'abord** (`loop-atoms.spec.tsx`) : deux instances sous UN
  store partagent bibliothèque et loop actif ; recall/drag pilotent un player
  enregistreur (région posée, seek, stop du ramp) ; le snap lit la grille
  semée dans `tempoAnalysisAtom` — rouge sur les `useState` privés, verte
  sur les atomes.
- **Les régions lisent elles-mêmes** : `ShellMain` (`useLoops()` +
  `useLoopEditing()`) et `ShellStage` (`useLoopEditing()`). Le shell garde son
  instance `useLoops()` pour le project-session, et le re-lien d'un loop
  restauré est un seat direct de `activeLoopIdAtom` (aucune logique). Cliquet
  `MAX_RETURN_TYPE_PROPS` **10 → 7** (`composition-invariants.spec.ts`).
- **Arêtes Sheriff explicites** : `web:feature:loops →
  web:feature:audio-session` (le player de session) et `→ web:feature:tempo`
  (l'atome de grille) — commentées dans `sheriff.config.ts` comme les
  précédentes.

## Not done / remaining

- **7 props `ReturnType` restants** : `chart`/`chordChart` (lead-sheet),
  `tempo`+`metronome` (use-tempo-detection), `mixer`+`metronome`
  (use-separate-and-load), `tempoDetection` (use-resume-gated-analysis) —
  des deps d'orchestrateurs du shell, plus des sacs de région : la forme de
  la feuille change (dériver des atomes, pas déplacer un sac).
- L'**interface étroite de session (DIP)** reste en feuille d'après — le
  germe existe déjà : `CountInPlayer` est déclaré côté seam
  (`audio-session.ts`) et implémenté par l'adaptateur
  (`audio/count-in-player.ts`) ; la feuille généralise ce motif là où un
  consommateur n'utilise qu'une tranche d'un port core.

## Decisions

- Aucune décision nouvelle — application des ADR 0010/0011/0012 telles
  quelles. La feuille ajoute un cas au critère : quand le sac PILOTE le
  player, le pilotage passe par le `PlayerHandle` de session (qui s'élargit
  d'une méthode impérative, `setLoopRegion`) — jamais par une lecture des
  atomes du waveform depuis `loops`, qui créerait le cycle que l'ADR 0012
  interdit. L'état de vue (durée) ne monte PAS sur le handle : l'API passe
  en secondes et la conversion revient à la région qui lit déjà le
  transport.
- Module watch : aucun signal côté core (aucune source core touchée).

## Gate status

- `pnpm gate` ✅ complet (tampon `da96c43d`) : typecheck ✅ · biome ✅ ·
  sheriff ✅ (arêtes déclarées) · design/react ✅ · tokens/i18n ✅ ·
  knip ✅ · jscpd ✅.
- tests : ✅ suite complète verte (1129 tests web, +6), couverture 96,83 %
  statements / 92,30 % branches.
- mutation : **sans objet** — aucune source core touchée (web uniquement).
- sonar : ✅ quality gate OK sur la PR #306 — 0 issue ouverte, 0 hotspot.

## State to resume from

- **Single next action** : feuille suivante du chantier — l'**interface
  étroite de session (DIP)** : le seam déclare les interfaces que ses
  consommateurs exigent (motif `CountInPlayer`/`PlayerHandle`), les
  adaptateurs les implémentent ; à défaut, entamer la résorption des 7
  `ReturnType` d'orchestrateurs (dériver des atomes).
- Gotchas :
  - `PlayerHandle.setLoopRegion` garde la sémantique du player (re-arm sur
    région fraîche, stop du ramp sur clear) — une feature ne doit jamais
    écrire `loopRegionAtom` directement, l'arête `loops → waveform`
    n'existe pas et ne doit pas naître.
  - `useLoopEditing` parle en SECONDES ; la surface waveform parle en
    fractions — la conversion vit dans `ShellStage`, seule frontière entre
    les deux monnaies.
  - Le shell seat `activeLoopIdAtom` directement au restore (pas de
    `useLoopEditing` hors du provider enrichi : `usePlayerHandle()` y
    jetterait).
