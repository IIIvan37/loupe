# Session — 2026-07-31 — use-tempo-detection dérive ses deps (ADR 0010, cliquet 7 → 5)

## Done

- **Feuille Mikado ADR 0010** (branche `refactor/tempo-detection-derives`,
  PR #318 ouverte) : le hook de coordination `use-tempo-detection` quitte le
  shell pour `app/tempo/` et **dérive ses deps lui-même** — `useTempo()`
  interne (sac déjà en atomes, #302) et `useMetronome({ mixer })` interne.
  Ses deux props `ReturnType<typeof useX>` tombent ; n'entrent plus que le
  seam `mixer: Mixer` (idiome `MetronomeDeps`) et des valeurs (`loadedAudio`,
  `separationOwnsMix`).
- **`enabled` du métronome passe en atome de feature**
  (`metronomeEnabledAtom`, `tempo-atoms.ts`) : l'instance du shell (count-in,
  raccourcis, session projet) et celle du hook s'accordent sur « un clic est
  assis », quel que soit celui qui l'a assis. C'était le prérequis de la
  feuille — avec un `useState`, la seconde instance aurait vu `false` et
  `seatManualClick` aurait ré-`enable` par-dessus un clic déjà assis.
- Specs rouges d'abord : deux instances `useMetronome` sous un store
  partagent `enabled` (seat croisé, reset croisé) ; nouveau contrat de
  `useTempoDetection` (détecteur injecté par la session — ADR 0011, clic
  assis via le seam mixer, defer AG.1, retry explicite) — 5 cas.
- **Cliquet `MAX_RETURN_TYPE_PROPS` 7 → 5** dans la même PR
  (`composition-invariants.spec.ts`).
- File Dependabot : #315 fermée par Dependabot lui-même (supersédée) et
  recréée en **#317** (8 bumps, react-doctor déjà fait par #316) — CI en
  cours, merges = action opérateur.

## Not done / remaining

- **5 props `ReturnType` restants** : `use-separate-and-load` (`mixer`,
  `metronome`), `use-resume-gated-analysis` (`tempoDetection`),
  `use-chart-with-structure` (`chordChart`), `use-chord-chart-session`
  (`chart`).
- Le seam `mixer: Mixer` reste un prop de `useTempoDetection` : il ne
  tombera que quand le corps du shell passera **sous** la session enrichie
  (aujourd'hui le shell rend le provider lui-même, un `useMixer()` nu y
  jette). Feuille candidate si les prochains hooks butent dessus aussi.

## Decisions

- **Un hook de coordination migre en dérivant, pas en re-typant** : remplacer
  `ReturnType<typeof useX>` par l'interface nommée équivalente ferait taire le
  cliquet sans réduire le couplage. La feuille dérive (`useTempo()`,
  `useMetronome()` internes) et ne garde en prop que le seam moteur —
  application de l'ADR 0010, pas d'ADR nouveau.
- **L'état « un clic est assis » est un état de session, pas d'instance** —
  même leçon que la boîte de run de #302 : rendre un hook multi-instances
  exige de partager AUSSI ce que ses instances doivent voir ensemble.
- Module watch : aucun signal côté core (aucune source core touchée).

## Gate status

- `pnpm gate` ✅ complet (tampon `b91877f1`) : typecheck ✅ · biome ✅ ·
  sheriff ✅ · design/react ✅ · tokens/i18n ✅ · knip ✅ · jscpd ✅.
- tests : ✅ suite verte (+7 specs : 2 métronome partagé, 5 nouveau contrat),
  couverture 96,83 % statements / 92,33 % branches.
- mutation : **sans objet** — aucune source core touchée (web uniquement),
  confirmé par `pnpm test:mutation:diff`.
- sonar : analyse PR #318 en cours au moment du rapport — à relire avant
  merge (`pnpm sonar`).

## State to resume from

- **Single next action** : feuille 0010 suivante — `use-separate-and-load`
  (2 des 5 : `mixer`, `metronome`) ; le métronome se dérive désormais
  (`useMetronome({ mixer })` interne, `enabled` partagé), le seam `mixer`
  suit le même idiome que cette feuille.
- Gotchas :
  - `metronomeEnabledAtom` : toute spec montant `useMetronome` hors Provider
    écrit le store jotai par défaut (global au fichier de test) — monter sous
    un store frais dès qu'un test LIT `enabled`.
  - Le corps du shell est HORS session enrichie (il rend le provider) : un
    hook qui y est appelé ne peut pas dériver le mixer nu — d'où le seam.
    Si `use-resume-gated-analysis` / les feuilles chart butent pareil,
    envisager la feuille « le corps du shell passe sous la session ».
  - Dependabot : #317 à merger si verte (opérateur) ; #180 (TS 7) et #53
    restent la session outillage dédiée.
