# Session — 2026-08-04 — revue SOLID, lot ISP (seams du Mixer)

Troisième et dernier lot de solde des constats de la revue SOLID (rapport
`2026-08-04-revue-solid.md`) : le constat n° 6 — le sac `Mixer` (12 membres)
traversait 6 hooks qui en consomment 0 à 5.

## Done

- **`MetronomeMixer`** (déclaré chez `use-metronome`, l'idiome
  `Pick<…>` déjà pervasif dans les deps du dossier orchestration) : les
  5 membres que seatter un click exige (`state`, `restore`, `addStem`,
  `replaceStem`, `toggleMute`). Les trois hooks de pur forwarding
  (`use-tempo-detection`, `use-run-tempo-detection`,
  `use-resume-gated-analysis`) déclarent CE seam — plus jamais la façade —
  donc ne dépendent plus des faders, du solo ni du filtre de ton.
- **`use-separate-and-load`** : `Pick<Mixer, 'load'> & MetronomeMixer` —
  sa tranche d'adoption plus le seat qu'il transmet.
- **`restoreSession`** (`project-session.ts`) : `Pick<Mixer, 'restore'>` —
  l'unique membre que le use-case pilote ; `use-project-session` élargit à
  `Pick<Mixer, 'restore' | 'reset' | 'state'>` (open + save + import frais).
- **Specs allégées** : les 4 fakes 12 membres (metronome, tempo-detection,
  separate-and-load, resume-gated) et celui de project-session ne stubbent
  plus que leur seam — les `vi.fn()` jamais appelés disparaissent, et
  l'assertion « `load` n'est pas appelé » du spec métronome devient le
  typechecker lui-même (le seam ne connaît pas `load`).
- Le shell passe toujours l'unique `Mixer` concret : satisfaction
  structurelle, aucun objet nouveau — ce qui se rétrécit est qui voit quoi,
  jamais l'instance (le pattern des 3 seams de `StemPlaybackEngine`,
  `audio-session.ts`).

## Not done / remaining

- **Lot 4 outillage** (§ « Backlog outillage » du rapport revue-solid,
  10 actions) — le solde des 6 constats de la revue est terminé avec ce lot.
- Verdict Sonar de cette PR : à lire après le passage du CI.

## Decisions

- Deux idiomes de rétrécissement coexistent et se répondent : le seam
  déclaré à la main quand le consommateur possède un vocabulaire propre
  (`StemMixGraph`), le `Pick<Façade, …>` quand la façade reste la source
  des signatures (deps d'orchestration). Ici `Pick` partout : zéro
  signature dupliquée, le compilateur suit la façade.

## Gate status

- typecheck : ✅ (dans le gate)
- tests (with coverage) : ✅ — 91,41 % lines / 89,47 % branches
- mutation (Stryker) : **sans objet** — aucun module core touché (web
  uniquement) ; le run complet post-merge de CI reste la référence
- biome / sheriff / knip / jscpd / tokens / i18n / sonar-triage : ✅
  (`gate ok`, arbre stampé `b1ec31d6`)
- SonarCloud : en attente du CI de la PR

## State to resume from

- **Single next action** : ouvrir la PR de ce lot ; après son merge, le
  backlog des 6 constats est soldé — enchaîner le lot 4 outillage ou revenir
  au labo starter (récolte `playback/`), au choix du pilote.
- Gotchas : `MetronomeMixer` est exporté par `use-metronome.ts` — un futur
  consommateur du mixer déclare sa tranche (`Pick`) au lieu d'importer
  `Mixer` entier ; les fakes de specs ne stubbent que le seam déclaré.
