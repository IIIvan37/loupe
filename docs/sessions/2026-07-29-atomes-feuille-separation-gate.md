# Session — 2026-07-29 — ADR 0010 feuille 3 (gate séparation → atome)

## Done

- **Troisième feuille Mikado** (branche `feat/atomes-feuille-separation-gate`) :
  `app/separation/separation-atoms.ts` créé — un atome primitif
  `separationGateReasonAtom`, le seul champ de vue de `useSeparation` qu'un hook
  de coordination lit **seul**. Zéro logique dans le fichier : toutes les
  transitions restent dans `useSeparation` (garde-fou anti-érosion de l'ADR).
- `useSeparation` garde son API et toute sa logique (runId, abort controller,
  supersede, export…) ; seul son `useState` `gateReason` devient un `useAtom`.
- **Harvest** — `use-resume-gated-analysis` délesté de sa prop
  `separation: ReturnType<typeof useSeparation>` : il ne lisait que
  `separation.gateReason`, il lit l'atome ; `workstation-shell` ne passe plus
  `separation` à cet appel.
- **Cliquet `MAX_RETURN_TYPE_PROPS` descendu 24 → 23** (vérifié tight :
  22 échoue). Contrat de feuille tenu : au moins un cliquet baisse dans la PR.
- Isolation des tests : `separation-atoms.spec.tsx` monte `useSeparation` + un
  consommateur étranger sur **un** store (deux arbres) pour prouver la lecture
  croisée sans prop, comme `tempo-atoms.spec.tsx`. `use-separation.spec.tsx` et
  `use-separation-abort.spec.tsx` montent sous un wrapper `TestProviders`
  (I18nTestingProvider + `Provider` Jotai sans store = store frais par montage)
  — même idiome que tempo/mixer.

## Not done / remaining

- Les autres champs de vue de `useSeparation` (`state`, `sources`,
  `exportError`) restent locaux : leurs consommateurs (shell-main,
  shell-analyser-row, shell-header, use-separate-and-load) lisent **aussi**
  des callbacks (`separate`, `cancel`, `reset`…) — pas de harvest possible tant
  que l'API impérative n'est pas atteignable autrement.
- Les deux sacs restants non migrables par simple atome de vue :
  `use-tempo-detection.tempo` (API impérative de `useTempo`) et
  `use-separate-and-load.mixer` (lit `mixer.load`). C'est le mur que
  l'[ADR 0011](../adr/0011-shell-layout-contexte-session-audio.md) nomme : la
  clé de voûte (contexte de session audio) doit venir pour continuer à vider
  le shell.

## Decisions

- **Même motif que la feuille 2, versant séparation** : seul le champ qu'un
  consommateur étranger lit seul migre en atome ; le reste attend son
  consommateur. Voir [ADR 0010](../adr/0010-etat-de-vue-atomes-par-feature.md).
- Aucune décision de frontière nouvelle — la feuille applique 0010 ; la
  prochaine décision structurante (AudioSessionProvider) est déjà écrite dans
  l'[ADR 0011](../adr/0011-shell-layout-contexte-session-audio.md).

## Gate status

- typecheck : ✅ · biome/`check` : ✅ (1 info préexistant `useLiteralKeys` sur
  `chord-chart.ts`, non bloquant, non touché) · sheriff `check:arch` : ✅ ·
  `check:design` (impeccable) : ✅ · `check:react` (react-doctor, bloquant) : ✅ ·
  knip : ✅ · jscpd : ✅
- tests : ✅ **2402/2402** (`npx vitest run --coverage --maxWorkers=5`, workers
  bridés — gotcha CPU connu). Cliquet vérifié tight (22 échoue → remis à 23).
- mutation : **sans objet** — aucune source core touchée
  (`pnpm test:mutation:diff` le confirme).

## State to resume from

- **Single next action** : la clé de voûte de l'ADR 0011 —
  `AudioSessionProvider` (moteur + ports en contexte de session, références
  stables uniquement). Les feuilles d'état pur sont épuisées : les 23 props
  `ReturnType` restantes tiennent toutes à des callbacks/API impératives que
  seul le contexte rendra atteignables sans threading. Alternative plus petite
  s'il faut une feuille courte : migrer `separation.state` en
  `atomWithReducer` (comme le mixer) — mais sans harvest de cliquet évident.
- Gotchas :
  - Toute spec montant `useSeparation` doit être sous un `Provider` Jotai
    (store frais par montage) — idiome `TestProviders` dans les deux specs.
  - Run coverage local fiable : `npx vitest run --coverage --maxWorkers=5`.
  - Le contexte de session (0011) ne doit porter **que** des références
    stables — jamais un champ qui change à l'usage (revue, pas d'outil).
