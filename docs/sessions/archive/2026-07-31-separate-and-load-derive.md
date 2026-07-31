# Session — 2026-07-31 — use-separate-and-load dérive ses deps (ADR 0010, cliquet 5 → 3)

## Done

- **Feuille Mikado ADR 0010** (branche `refactor/separate-and-load-derives`,
  PR #320 ouverte) : `use-separate-and-load` **dérive ses deps lui-même** —
  `useMetronome({ mixer })` interne (possible depuis #318 : `enabled` est un
  atome de session, l'instance dérivée et celle du shell s'accordent sur « un
  clic est assis »). Ses deux props `ReturnType<typeof useX>` tombent ;
  n'entre plus que le seam `mixer: Mixer` (idiome `MetronomeDeps`, même
  feuille que `use-tempo-detection`).
- **Le hook reste dans le shell** (pas de déménagement type `app/tempo/`) :
  il coordonne séparation + tempo + mixer, et le DAG web (ADR 0012) n'autorise
  pas `separation → tempo/mixer` — c'est le privilège de la racine de
  composition, pas un état de vue à rapatrier.
- **Specs rouges d'abord** — le hook n'avait aucune spec ; le nouveau contrat
  est pinné par 5 cas : chargement direct sans tempo connu · seat stems + clic
  en **un** `restore` avec tempo connu · le clic assis est celui de la
  **session** (`metronomeEnabledAtom` du store partagé passe à `true`) · les
  réglages courants du clic sont portés (pas le défaut) · pas d'audio →
  `undefined`, rien touché. Le stem masqué (`present: false`, stem quasi
  silencieux) ne devient pas un canal fantôme.
- **Cliquet `MAX_RETURN_TYPE_PROPS` 5 → 3** dans la même PR
  (`composition-invariants.spec.ts`).

## Not done / remaining

- **3 props `ReturnType` restants** : `use-resume-gated-analysis`
  (`tempoDetection`), `use-chart-with-structure` (`chordChart`),
  `use-chord-chart-session` (`chart`).
- Le seam `mixer: Mixer` reste un prop (ici comme dans `useTempoDetection`) :
  il ne tombera que quand le corps du shell passera sous la session enrichie —
  feuille candidate si les feuilles chart butent dessus aussi.

## Decisions

- **Un orchestrateur multi-features reste dans le shell** : la feuille tempo
  a déménagé `use-tempo-detection` vers sa feature ; celle-ci ne déménage pas
  `use-separate-and-load` vers `app/separation/` parce que le DAG web
  (ADR 0012) n'a pas d'arête `separation → tempo/mixer` et qu'en créer une
  pour un déménagement inverserait la charge — dériver suffit à faire tomber
  les `ReturnType`, l'emplacement n'était pas le problème.
- Module watch : aucun signal côté core (aucune source core touchée).

## Gate status

- `pnpm gate` ✅ complet (tampon `4f241d67`) : typecheck ✅ · biome ✅ ·
  sheriff ✅ · design/react ✅ · tokens/i18n ✅ · knip ✅ · jscpd ✅.
- tests : ✅ suite verte (+5 specs, nouveau contrat de `useSeparateAndLoad`),
  couverture 96,85 % statements / 92,39 % branches.
- mutation : **sans objet** — aucune source core touchée (web uniquement),
  confirmé par `pnpm test:mutation:diff`.
- sonar : analyse PR #320 en cours au moment du rapport — à relire avant
  merge (`pnpm sonar`).

## State to resume from

- **Single next action** : feuille 0010 suivante — `use-resume-gated-analysis`
  (`tempoDetection`) : même question dériver-vs-seam ; `useTempoDetection`
  prend déjà seulement `mixer` + valeurs, la dérivation devrait être directe
  si ses valeurs (`loadedAudio`, `separationOwnsMix`) restent des props.
- Gotchas :
  - `metronomeEnabledAtom` : toute spec montant le hook hors Provider écrit le
    store jotai par défaut — monter sous un store frais dès qu'un test LIT
    `enabled` (idem feuille tempo).
  - `useSeparation()` sans injection lit `session.separator` : les specs
    passent le port par `AudioSessionProvider value={{ separator }}` (et
    `I18nTestingProvider`, le hook parle par Lingui).
  - Un stem quasi silencieux (< 5 % de l'énergie du plus fort) sort
    `present: false` du pipeline — c'est le levier de spec pour le cas masqué.
