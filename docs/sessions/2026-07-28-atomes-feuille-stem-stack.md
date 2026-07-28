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
- Les **trois invariants `check:design`** de l'ADR (pas de prop
  `ReturnType<typeof useX>`, plafond de champs par `*Props`, plafond de hooks
  par composant) ne sont pas encore posés.
- Les 29 props `ReturnType<typeof useX>` et les 35 champs de `ShellMainProps`
  sont intacts : cette feuille valide la forme, elle ne dégraisse pas le shell.

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

- **Single next action** : PR #287 ouverte sur la branche — une fois mergée,
  poser les **trois invariants `check:design`** (cliquets au-dessus de
  l'existant) avant les feuilles suivantes, pour que chaque migration fasse
  descendre un seuil mesuré.
- Gotchas :
  - Toute spec montant `useMixer` (ou le shell) doit être sous un `Provider` :
    sans lui le mix du test précédent est encore chargé. Les specs actuelles ne
    le trahissaient pas — elles commencent toutes par un `load` complet.
  - `usePlayer` a perdu son 5e paramètre positionnel ; il lit l'atome.
  - Pour un run coverage local fiable : `npx vitest run --coverage
    --maxWorkers=5` (le `pnpm gate` nu est ininterprétable ici).
