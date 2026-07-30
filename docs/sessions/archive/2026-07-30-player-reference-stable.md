# Session — 2026-07-30 — le player en référence stable (ADR 0011)

## Done

- **La clé de voûte « player » de l'ADR 0011 est posée** (branche
  `refactor/player-reference-stable`) : le session context porte désormais le
  player comme **référence stable** (`PlayerHandle` : position `ExternalValue`,
  `readSpectrum`, seeks, `toggleLoop`, contrôles du speed-trainer), déclaré
  dans `audio-session` (types core + kit seulement — même seam DIP que
  `CountInPlayer`), construit par `usePlayer` (délégation `useLatest`, une
  seule identité pour toute la session — spec dédiée `use-player.spec.tsx`),
  monté par le shell via `AudioSessionWithPlayer` (le composant du seam porte
  l'enrichissement, pas le shell — son budget hooks reste à 25).
- **L'état de vue du player que les régions affichent est passé en atomes** :
  `player-atoms.ts` (importState, transport, loupe ×2, pitch) côté waveform,
  `speedTrainerStateAtom` côté loops, `countingInAtom` côté tempo. Les hooks
  porteurs (`usePlayer`, `useTransportEngines`, `useLoop`, `useSpeedTrainer`,
  `useCountIn`) gardent toutes les transitions ; leurs specs `renderHook`
  montent sous `Provider` (un store par test).
- **`ShellMain` et `ShellStage` sont devenues des régions smart** : elles
  lisent handle + atomes elles-mêmes. **13 props tombent de `ShellMainProps`
  (35 → 22)** — cliquet `MAX_PROPS_FIELDS` descendu d'autant ; `ShellStage`
  passe de 16 à 7 props, et lit la grille de tempo via `tempoAnalysisAtom`
  (le motif 0010).
- Contrat honnête au passage : `LoopControls`/`SpeedTrainerControls` prennent
  `Pick<SpeedTrainer, 'state' | 'start' | 'stop'>` — `recordPass` appartient
  au câblage transport, pas aux contrôles.

## Not done / remaining

- Les **21 props `ReturnType`** restantes sont inchangées — ce sont les sacs
  de feature (`markers`, `viewport`, `mixer`, `loops`, `loopEditing`,
  `separation`, `tempo`) : les prochaines feuilles 0010 les passeront en
  atomes, régions déjà prêtes à les lire.
- Le **footer transport** reste alimenté en valeurs par le shell (design
  #296) ; `useCountIn` et les orchestrateurs (session, raccourcis, export)
  consomment toujours le sac `usePlayer` — migration vers atomes/handle en
  feuilles suivantes.
- L'**interface étroite de session (DIP)** reste la feuille d'après.

## Decisions

- Le pourquoi de la frontière (référence stable vs valeur réactive, player
  cas-limite) est déjà dans l'[ADR 0011](../adr/0011-shell-layout-contexte-session-audio.md) —
  cette feuille l'implémente, rien de nouveau à acter.
- `usePlayerHandle()` **jette** hors du shell : contrairement aux ports, un
  player absent n'a pas d'« adaptateur réel » de repli — c'est une erreur de
  programmation, pas un défaut.
- Module watch : aucun signal côté core (aucune source core touchée).

## Gate status

- `pnpm gate` ✅ complet (tampon `7efa4427`) : typecheck ✅ · biome ✅ (1 info
  préexistant) · sheriff ✅ · design/react ✅ · tokens/i18n ✅ · knip ✅ ·
  jscpd ✅.
- tests : ✅ 1104/1104 (113 fichiers), couverture 96,8 % statements /
  92,3 % branches.
- mutation : **sans objet** — aucune source core touchée (web uniquement).
- sonar : à lire une fois l'analyse CI de la PR posée (~5 min après le push) —
  vérifier avant merge.

## State to resume from

- **Single next action** : feuilles 0010 suivantes — passer les sacs de
  feature en atomes (candidat : `markers`, le plus consommé) pour faire
  descendre les 21 props `ReturnType` ; puis l'interface étroite de session
  (DIP).
- Gotchas :
  - Le contexte de session ne doit porter QUE du stable : toute valeur qui
    change à l'usage est un atome, jamais un champ du Provider (garde-fou
    ADR 0011 — la revue est le seul détecteur).
  - Un hook d'état passé sur atome doit monter ses specs `renderHook` sous
    `Provider` jotai, sinon le store par défaut fuit entre tests.
  - Le budget hooks du shell est à 25 pile : tout hook ajouté au shell doit
    en faire tomber un autre (l'enrichissement du Provider vit dans
    `AudioSessionWithPlayer` précisément pour ça).
