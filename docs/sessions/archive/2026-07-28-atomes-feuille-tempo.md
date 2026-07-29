# Session — 2026-07-28 — ADR 0010 feuille 2 (tempo → atomes)

## Done

- **Deuxième feuille Mikado** (branche `feat/atomes-feuille-tempo`, PR #290) :
  `app/tempo/tempo-atoms.ts` créé — deux atomes primitifs `tempoAnalysisAtom` et
  `tempoGateReasonAtom`, les seuls champs de vue de `useTempo` qu'un hook de
  coordination lit **seul**. Zéro logique dans le fichier : les transitions
  restent dans `useTempo` (garde-fou anti-érosion de l'ADR respecté).
- `useTempo` garde son API et toute sa logique (token de run, supersede, fold,
  seatManual…) ; seuls ses `useState` `analysis` et `gateReason` deviennent des
  `useAtom`.
- **Harvest** — deux hooks de coordination délestés de leur prop
  `tempo: ReturnType<typeof useTempo>` :
  - `use-separate-and-load` lit `tempoAnalysisAtom` (il ne lisait que
    `tempo.analysis`) ;
  - `use-resume-gated-analysis` lit `tempoGateReasonAtom` (il ne lisait que
    `tempo.gateReason`).
  - `workstation-shell` ne passe plus `tempo` à ces deux appels.
- **Cliquet `MAX_RETURN_TYPE_PROPS` descendu 26 → 24** (mesuré tight par l'AST :
  23 échoue). Contrat de feuille tenu : au moins un cliquet baisse dans la PR.
- Isolation des tests : `tempo-atoms.spec.tsx` monte `useTempo` + un
  consommateur étranger sur **un** store (deux arbres) pour prouver la lecture
  croisée sans prop, comme `mixer-atoms.spec.tsx`. `use-tempo.spec.ts` monte sous
  un `Provider` frais par test (helper `renderTempo`, 43 sites) — même idiome que
  `use-mixer.spec.tsx`, isolation des atomes garantie sans reset manuel.

## Not done / remaining

- Les autres champs de vue de `useTempo` (`detecting`, `error`, `cancelled`,
  `octaveShift`, `manual`) restent en `useState` local : ils sont lus par le
  shell via le sac `tempo` (shell-main, shell-analyser-row), pas encore par
  atome. Feuilles suivantes.
- `shell-analyser-row` garde sa prop `tempo` : il lit de la vue (bpm, detecting,
  error, cancelled, gateReason) **mais aussi** un callback (`tempo.cancelDetection`)
  — pas migrable tant que l'API impérative n'est pas exposée autrement.
- `useSeparation` toujours pas en atomes (async, refs de run, ports injectés) —
  la feuille la plus chère, elle débloquera `stemsReady` + `use-resume-gated`
  côté séparation.

## Decisions

- **La feuille migre l'état, le harvest récolte un cliquet.** Comme le mixer
  (feuille 1) : on migre les champs de vue lus cross-feature vers des atomes,
  puis on bascule le(s) consommateur(s) qui ne lisent QUE de la vue pour lâcher
  leur prop `ReturnType`. Ici deux hooks de coordination d'un coup (26 → 24).
  Voir [ADR 0010](../adr/0010-etat-de-vue-atomes-par-feature.md).
- **Isolation des tests par `Provider`, pas par reset.** `use-tempo.spec.ts`
  monte via un helper `renderTempo(...args)` qui enveloppe dans `{ wrapper:
  Provider }` (Provider sans `store` = store frais par montage) — l'idiome exact
  du mixer (`use-mixer.spec.tsx`). Un premier jet avait isolé par
  `getDefaultStore().set(atom, undefined)` en `beforeEach` ; abandonné pour
  garder **un seul idiome d'isolation** dans la couche web (loupe = labo : la
  cohérence d'idiome est un livrable).

## Gate status

- typecheck : ✅ · biome/`check` : ✅ (1 info préexistant `useLiteralKeys` sur
  `chord-chart.ts`, non bloquant, non touché) · sheriff `check:arch` : ✅ ·
  `check:design` : ✅ · `check:react` (react-doctor 0.7.8, bloquant) : ✅ ·
  knip : ✅ · jscpd : ✅
- tests : ✅ **2399/2399** de code (`npx vitest run --coverage --maxWorkers=5`,
  workers bridés — le `pnpm gate` nu famine le CPU sur cette machine, gotcha
  connu de la feuille 1). Le seul rouge du run était `docs/docs.spec.ts`
  (6 rapports actifs > 5, dette pré-existante sur main) — réglé ici par
  l'archivage de d4b + d4c.
- mutation : **sans objet** — aucune source core touchée
  (`test:mutation:diff` le confirme).

## State to resume from

- **Single next action** : feuille Mikado 3 — migrer le prochain champ de vue
  de `useTempo` lu cross-feature, ou attaquer `useSeparation` (débloque
  `stemsReady` + le versant séparation de `use-resume-gated`). Chaque feuille
  doit faire **descendre au moins un des trois cliquets**
  (`composition-invariants.spec.ts`) dans sa propre PR — c'est le contrat.
- Gotchas :
  - Toute spec montant `useTempo` (ou le shell) doit être sous un `Provider`
    (store frais par montage), sinon l'état du test précédent fuit (atomes =
    singletons du store par défaut). Idiome : helper `renderTempo` /
    `{ wrapper: Provider }`.
  - Run coverage local fiable : `npx vitest run --coverage --maxWorkers=5`.
  - Cliquet `MAX_RETURN_TYPE_PROPS` est **tight à 24** : le baisser encore
    exige un vrai harvest, pas juste passer.
