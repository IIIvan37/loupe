# Session — 2026-07-30 — le moteur de stems en session, le mixer lu par les régions (ADR 0010/0011)

## Done

- **Troisième feuille « sacs de feature en atomes »** (branche
  `refactor/mixer-atom`, PR #303 ouverte) : le sac mixer était déjà en
  atomes (`mixer-atoms.ts`) — la feuille rend `useMixer()` appelable par
  n'importe quelle région et fait tomber le prop `mixer`.
- **Le moteur de stems rejoint la session enrichie (ADR 0011)** :
  `AudioSessionWithPlayer` assoit le `StemPlaybackEngine` singleton créé
  par le stack du shell, à côté du `player` — même geste, même raison :
  contrairement aux ports sans état (détecteurs), le moteur porte le PCM
  et le graphe de gains, donc un consommateur nu ne doit JAMAIS en créer
  un privé. `useMixer(engine?)` : argument optionnel (le stack continue de
  le passer), repli sur `session.stemEngine`, `throw` sinon (même contrat
  que `usePlayerHandle`).
- **`ShellStage` lit `useMixer()` lui-même** : le prop tombe de
  `ShellStageProps` et de `ShellMainProps` (pur passe-plat). Cliquet
  `MAX_RETURN_TYPE_PROPS` **17 → 15**.
- **Sheriff** : arête déclarée `web:feature:mixer → web:feature:audio-session`
  (acyclique — la session ne dépend de rien), motivée dans la config.
- Specs rouges d'abord : la session enrichie assoit le moteur ; `useMixer()`
  nu l'atteint et jette sans lui ; deux consommateurs sous un store (shell
  avec argument, région nue) partagent mix et graphe de gains — un mute de
  la région pousse le gain et le shell le voit.

## Not done / remaining

- **15 props `ReturnType` restants** : `viewport`, `loops`, `loopEditing`,
  `separation`, `metronome`, `tempo`, `chart`… Prochain candidat :
  `viewport` (lu par ShellMain, ShellStage, shortcuts, session) ou
  `separation`.
- L'**interface étroite de session (DIP)** reste en feuille d'après.
- Les orchestrateurs du shell (`useMetronome`, `useSeparateAndLoad`,
  `useProjectSession`, count-in, export) reçoivent toujours l'instance
  mixer du shell — consommateurs comme les autres, rien à migrer tant
  qu'un cliquet ne le réclame pas.

## Decisions

- **Un port À ÉTAT ne se replie pas comme un port sans état.** `useTempo`
  peut créer son détecteur au site de consommation (stateless) ; le moteur
  de stems, lui, est le custodian du PCM et du graphe de gains — son
  absence dans la session est une erreur de programmation, pas un cas de
  repli. C'est le complément côté « ports » de la leçon de la feuille
  tempo (boîte de run partagée) : ce qui porte un état de session doit
  avoir UNE identité par session. Pas d'ADR nouveau — application des ADR
  0010/0011.
- Module watch : aucun signal côté core (aucune source core touchée).

## Gate status

- `pnpm gate` ✅ complet (tampon `d4c30c1a`) : typecheck ✅ · biome ✅ ·
  sheriff ✅ · design/react ✅ · tokens/i18n ✅ · knip ✅ · jscpd ✅.
- tests : ✅ suite complète verte (web 1117/1117), couverture 96,8 %
  statements / 92,3 % branches.
- mutation : **sans objet** — aucune source core touchée (web uniquement).
- sonar : analyse CI de la PR #303 en attente au moment du rapport — à
  lire (`pnpm sonar 303`) avant merge.

## State to resume from

- **Single next action** : feuille 0010 suivante — passer le sac `viewport`
  (ou `separation`) en atomes pour continuer à descendre les 15 props
  `ReturnType` ; puis l'interface étroite de session (DIP).
- Gotchas :
  - `useMixer()` nu exige un moteur dans la session : toute spec qui le
    monte hors du shell doit injecter `stemEngine` via
    `AudioSessionProvider` (le kit du shell le fait déjà), sinon le hook
    jette à dessein.
  - L'ordre des hooks dans `useMixer` est délibéré : le memo `channels`
    précède `requireStemEngine` pour que tous les hooks restent
    inconditionnels avant le `throw`.
  - Un sac dont le hook pilote un adaptateur à état ne devient
    multi-instances qu'en partageant AUSSI l'adaptateur (session, ADR
    0011) — partager les atomes sans le moteur ferait diverger son et vue.
