# Session — 2026-07-30 — le sac tempo en atomes (ADR 0010)

## Done

- **Deuxième feuille « sacs de feature en atomes »** (branche
  `refactor/tempo-atom`, PR #302 ouverte) : les cinq champs restants du sac
  (`detecting`, `cancelled`, `error`, `octaveShift`, `manual`) rejoignent
  l'analyse dans `tempo-atoms.ts`. `useTempo` garde **toutes** les
  transitions (detect/gate, fold, overrides, set/reset) — le hook devient
  appelable par n'importe quel consommateur, tous voient le même tempo de
  session.
- **Le jeton de run + l'AbortController passent en boîte partagée par store**
  (`tempoRunAtom`, atome read-only à init par store, muté en place, jamais
  rendu) : un `cancelDetection` depuis la ligne d'analyse ou un `set`
  d'ouverture de projet supersède le detect lancé par une autre instance.
  C'était le point dur de la feuille — avec des refs privés, le cancel
  croisé n'aurait rien annulé. Le cleanup d'unmount n'aborte que les runs
  démarrés par l'instance qui se démonte (`myControllerRef`).
- **`ShellMain` et `ShellAnalyserRow` lisent `useTempo()` elles-mêmes** :
  les props `tempo` et `grid` (dérivable) tombent ; les six callbacks
  `on*Tempo` de `ShellMain` se replient en un prop
  `tempoDetection: TempoDetection` (même idiome que `chordDetection`).
  Cliquets descendus dans la même PR : `MAX_RETURN_TYPE_PROPS` **19 → 17**,
  `MAX_PROPS_FIELDS` **21 → 20** (`ShellMainProps` 21 → 15 ; le plus large
  est désormais `HeaderProps`).
- Specs rouges d'abord (`tempo-atoms.spec.tsx`) : deux instances sous un
  store partagent busy/erreur/octave/manuel ; cancel croisé qui aborte le
  run en vol ; seat croisé qui supersède ; reset croisé qui efface l'erreur.

## Not done / remaining

- **17 props `ReturnType` restants** : `viewport`, `mixer`, `loops`,
  `loopEditing`, `separation`, `metronome` (et leurs redescendus dans les
  hooks de coordination). Prochain candidat : `mixer` (lu par ShellMain,
  ShellStage, use-separate-and-load) ou `viewport`.
- L'**interface étroite de session (DIP)** reste en feuille d'après.
- Le shell garde son instance `useTempo()` pour ses orchestrateurs
  (`useTempoDetection`, `useProjectSession`, `gateReasonsOf`, count-in,
  export) — consommateurs comme les autres, rien à migrer tant qu'un
  cliquet ne le réclame pas.

## Decisions

- **La boîte de run partagée est le complément nécessaire du sac en atomes**
  quand un hook porte un process asynchrone supersédable : partager l'état
  sans partager le jeton laisserait chaque instance annuler dans le vide.
  Pattern : atome read-only à init par store (`atom(() => ({...}))`),
  mutation en place, jamais lu pour le rendu. Pas d'ADR nouveau — c'est une
  application de l'ADR 0010, la garde anti-érosion inchangée.
- Module watch : aucun signal côté core (aucune source core touchée).

## Gate status

- `pnpm gate` ✅ complet (tampon `5dd7d1e1`) : typecheck ✅ · biome ✅ ·
  sheriff ✅ · design/react ✅ · tokens/i18n ✅ · knip ✅ · jscpd ✅.
- tests : ✅ 2420/2420 (173 fichiers), couverture 96,8 % statements /
  92,3 % branches.
- mutation : **sans objet** — aucune source core touchée (web uniquement).
- sonar : ✅ quality gate OK sur la PR #302 — 0 issue ouverte, 0 hotspot.
- CI PR #302 : ✅ tous les checks verts (commit messages, dependency audit,
  edge functions, quality gate, server, SonarCloud ; mutation core skippée —
  aucune source core).

## State to resume from

- **Single next action** : feuille 0010 suivante — passer le sac `mixer`
  (ou `viewport`) en atomes pour continuer à descendre les 17 props
  `ReturnType` ; puis l'interface étroite de session (DIP).
- Gotchas :
  - `useTempo` est désormais de l'état partagé : toute spec qui le monte
    doit passer sous un `Provider` jotai frais (le kit du shell le fait
    déjà), sinon le store par défaut fuit entre tests.
  - `tempoRunAtom` est interne à `useTempo` — aucun autre module ne doit le
    toucher ; les transitions restent DANS le hook (garde ADR 0010).
  - Un sac dont le hook porte des refs de process (run token, controller)
    ne se migre pas en changeant seulement le stockage : la boîte de run
    doit devenir partagée, sinon les actions croisées (cancel/seat depuis
    une autre instance) sont des no-ops silencieux.
