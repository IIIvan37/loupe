# Session — 2026-07-28 — ADR 0010 accepté + première feuille Mikado (mixer → atomes)

## Done

- **ADR 0010 accepté** (PR #286, mergée) : l'état de vue appartient à sa feature,
  le shell compose. Skill `react-ts` livré dans la même PR.
- **Première feuille Mikado** (branche `feat/atomes-feuille-stem-stack`,
  PR #287) : `jotai` ajouté à `@app/web`, `app/mixer/mixer-atoms.ts` créé
  (`mixerStateAtom` via `atomWithReducer` sur le `mixerReducer` du core,
  `mixableAtom`, `stemFiltersAtom`, `stemsActiveAtom` dérivé).
- `useMixer` garde son API et tout le pilotage du moteur ; seuls ses
  `useReducer`/`useState` deviennent des atomes.
- `stemsActive` cesse d'être threadé : `useStemStack` ne le retourne plus, le
  shell ne le passe plus, `usePlayer` lit `stemsActiveAtom` (5e paramètre
  positionnel supprimé).
- Isolation des tests : `Provider` de Jotai par rendu dans `renderShell` et dans
  `use-mixer.spec.tsx` ; `mixer-atoms.spec.tsx` monte deux arbres sur **un**
  store pour prouver la lecture croisée sans prop. `<Provider>` explicite dans
  `main.tsx`.

## Not done / remaining

- Les 4 autres hooks de coordination du shell (~410 lignes) : `use-stem-stack`
  ne perd que `stemsActive`, `stemsReady` reste une prop.
- L'état de `useSeparation` n'a pas bougé (async, refs de run, ports injectés) —
  c'est la feuille suivante logique, et la plus chère.
- Les 29 props `ReturnType<typeof useX>` (26 après cette feuille) et les 35
  champs de `ShellMainProps` sont intacts : cette feuille valide la forme et
  pose les cliquets, elle ne dégraisse pas encore le shell.

## Ajout — les trois cliquets de composition (même PR)

- **`composition-invariants.spec.ts`** grave les trois invariants de l'ADR en
  fitness function AST (le pattern « ratchet des docs » que l'ADR cite,
  cf. `docs/docs.spec.ts`) : plafonds **≤ 26** props `ReturnType<typeof useX>`
  (cible 0), **≤ 35** champs sur le plus large `*Props` (`ShellMainProps`),
  **≤ 25** hooks dans le composant le plus chargé (`WorkstationShell`).
- Seuils calés sur l'existant mesuré (AST, TypeScript compiler API), destinés
  à **descendre d'un cran par feuille** ; jamais monter. La spec vit dans les
  globs vitest → bloquante dans la gate, exclue de la couverture (`**/*.spec`).
- Ce que Sheriff et react-doctor ne voient pas : un `ReturnType<typeof useX>`
  entre deux dossiers de `web` est un import légal ; le cliquet est le seul à
  compter le couplage par sac de hook.

## Decisions

- **La feuille annoncée « 32 lignes » n'existait pas.** `use-stem-stack` ne
  détient aucun état : il compose `useMixer` (~200 lignes) et `useSeparation`
  (~250). Migrer ses flags = déplacer l'état des features. Réduit au mixer seul
  pour valider la forme sur le plus petit des deux — l'ADR 0010 reste vrai, son
  estimation de coût pour cette feuille ne l'était pas.
- **`stemsActiveAtom` est un booléen dérivé des atomes primitifs**, pas d'une
  liste de vues dérivée. Un atome dérivé rendant un tableau frais re-rend tous
  ses consommateurs à chaque écriture (react-doctor le signale, à raison) ; un
  scalaire ne les réveille qu'au basculement. Le join des `channels` reste donc
  un `useMemo` dans le hook.
- **Pas de helper de test partagé** : le wrapper cherché est le `Provider` de
  Jotai lui-même (un store par montage). Le fichier `lib/testing-store.tsx`
  écrit puis supprimé — `deslop/unused-file` le signalait, et il avait raison.
- Garde-fou de l'ADR respecté : aucune logique de transition dans un write-atom
  (le `mixerReducer` du core reste seul décideur, les appels moteur restent
  dans le hook).

## Gate status

- typecheck : ✅ · biome/`check` : ✅ · sheriff `check:arch` : ✅ ·
  `check:design` : ✅ · `check:tokens` : ✅ · knip : ✅ · jscpd : ✅
- `check:react` (react-doctor 0.7.8, bloquant dès warning) : ✅ — 2 warnings
  trouvés et **corrigés** en cours de route (atome dérivé à objet frais,
  fichier inutilisé).
- tests : ✅ **2394/2394**, coverage incluse (`vitest run --coverage
  --maxWorkers=5`, exit 0, seuils tenus).
- ⚠️ **`pnpm gate` tel quel échoue sur cette machine** : `test:coverage` en
  parallélisme plein famine le CPU (load ~50 sur 14 cœurs) et des specs shell
  tombent en timeout à 15 s. **Ce n'est pas le changement** : mesuré sur l'arbre
  propre (main, sans jotai), le même run échoue avec 16 tests, contre 11 sur la
  branche. Brider les workers rend le run déterministe et vert.
- mutation : sans objet — aucune source core touchée (`test:mutation:diff` le
  confirme et n'a rien à muter).

## State to resume from

- **Single next action** : les cliquets sont posés (même PR #287). Prochaine
  **feuille Mikado** — le hook de coordination suivant. Candidat le moins cher
  après le mixer : `use-resume-gated-analysis` (58 lignes, dérive tempo +
  séparation) ou `use-stem-stack` complété (`stemsReady` encore threadé).
  Chaque feuille doit faire **descendre au moins un des trois cliquets**
  (`composition-invariants.spec.ts`) dans sa propre PR — c'est le contrat.
- Gotchas :
  - Toute spec montant `useMixer` (ou le shell) doit être sous un `Provider` :
    sans lui le mix du test précédent est encore chargé. Les specs actuelles ne
    le trahissaient pas — elles commencent toutes par un `load` complet.
  - `usePlayer` a perdu son 5e paramètre positionnel ; il lit l'atome.
  - Pour un run coverage local fiable : `npx vitest run --coverage
    --maxWorkers=5` (le `pnpm gate` nu est ininterprétable ici).
