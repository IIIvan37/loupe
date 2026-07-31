# Session — 2026-07-31 — use-resume-gated-analysis dérive le flow tempo (ADR 0010, cliquet 3 → 2)

## Done

- **Feuille Mikado ADR 0010** (branche `refactor/resume-gated-analysis-derives`,
  PR #321 ouverte) : `useResumeGatedAnalysis` **dérive le flow tempo lui-même**
  — son prop `tempoDetection: ReturnType<typeof useTempoDetection>` tombe ;
  n'entrent plus que le seam `mixer: Mixer` (idiome `MetronomeDeps`) et des
  valeurs (`loadedAudio`, `separationOwnsMix`).
- **Extraction `use-run-tempo-detection.ts`** (`app/tempo`) : le flow
  detect → seat-click partagé par l'auto-run d'import, le « Réessayer » du
  panneau et le replay gated. Un hook **sans effet** — tempo et métronome sont
  état de session, donc toute instance dérivée exécute exactement le flow du
  shell. `useTempoDetection` le dérive à son tour ; son interface publique ne
  bouge pas.
- **Specs rouges d'abord** — le hook resume n'avait aucune spec ; le contrat de
  replay est pinné par 7 cas : tempo gated → détecteur de **session** + clic
  assis (`metronomeEnabledAtom`) · séparation possédant le mix → l'analyse
  atterrit, le mix intact · séparation gated → `separateAndLoad(loadedAudio)` ·
  structure/accords gated → leur `detect` · rien de gated → rien · tempo gated
  sans audio → rien.
- **Cliquet `MAX_RETURN_TYPE_PROPS` 3 → 2** dans la même PR
  (`composition-invariants.spec.ts`).

## Not done / remaining

- **2 props `ReturnType` restants**, tous côté chart :
  `use-chord-chart-session` (`chart: ReturnType<typeof useChordChart>`) et
  `use-chart-with-structure` (`chordChart: ReturnType<typeof useChordChartSession>['chart']`).
  Les deux sont chaînés — possiblement une seule feuille.
- Le seam `mixer: Mixer` reste un prop partout (inchangé depuis #320).

## Decisions

- **On ne dérive que des hooks sans effet de montage** : dériver
  `useTempoDetection` entier aurait monté un second effet auto-detect (double
  round-trip détecteur à chaque import) et son `suppressNextAutoDetect` est un
  ref d'instance — un open n'arme que celui du shell, l'instance dérivée aurait
  re-détecté par-dessus l'analyse restaurée. La coupe Mikado est donc
  l'extraction du flow (sans effet) puis sa dérivation — pas le déménagement,
  pas la dérivation du hook à effet.
- L'orchestrateur resume reste au shell (multi-features : structure + accords +
  tempo + séparation), même règle que `use-separate-and-load` (#320).
- Module watch : aucun signal côté core (aucune source core touchée).

## Gate status

- `pnpm gate` ✅ complet (tampon `fc6ca461`) : typecheck ✅ · biome ✅ ·
  sheriff ✅ · design/react ✅ · tokens/i18n ✅ · knip ✅ · jscpd ✅.
- tests : ✅ suite verte (1155, +7 specs du nouveau contrat de replay),
  couverture 97,01 % statements / 92,68 % branches.
- mutation : **sans objet** — aucune source core touchée (web uniquement),
  confirmé par `pnpm test:mutation:diff`.
- sonar : analyse PR #321 en cours au moment du rapport — à relire avant
  merge (`pnpm sonar`).

## State to resume from

- **Single next action** : feuilles 0010 restantes — le cluster chart :
  `use-chord-chart-session` (`chart`) puis `use-chart-with-structure`
  (`chordChart`), chaînés donc à regarder ensemble ; même question
  dériver-vs-seam (le chart est-il état de session en atomes ?).
- Gotchas :
  - Dans un harnais de spec, un paramètre destructuré avec défaut
    (`loadedAudio = AUDIO`) avale un `undefined` explicite — passer un drapeau
    (`noAudio`) pour tester le cas absent.
  - `useRunTempoDetection` est volontairement sans effet : toute feuille qui
    voudrait le doter d'un auto-run recréerait le bug de double instance —
    l'effet reste dans `useTempoDetection`, monté une fois par le shell.
