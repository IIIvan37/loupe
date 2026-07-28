# Session — 2026-07-28 — Stryker `ignoreStatic` (mutants statiques)

## Done

- **`stryker.config.json` : `ignoreStatic: true`** (branche
  `perf/stryker-ignore-static`, PR). Seule des 7 recommandations de
  [l'article](https://medium.com/@giorgi0203/stop-making-stryker-run-tests-it-never-needed-9afb7a2e1627)
  qui manquait : la config faisait déjà `coverageAnalysis: "perTest"` (#1),
  `mutate` scopé core (#3), `incremental: true` (#5), `ignorePatterns` (#6) ;
  `jest` (#2) est sans objet (runner vitest).
- **Mécanisme.** Avec `perTest`, un mutant dans du code exécuté **au chargement
  du module** (hors fonction) ne peut être rattaché à aucun test — Stryker le
  rejoue alors contre **toute la suite**. `ignoreStatic` les saute (sûr : exige
  `perTest`, déjà là).

## Mesure (le point de la session)

Deux runs `--reporters clear-text`, cache incrémental vidé avant chacun :

| Cible | Mutants | Statiques | Temps |
|---|---|---|---|
| `harmony/domain/chroma.ts` (fonctions pures) | 126 | **0** | 99 s vs 93 s (bruit) |
| `harmony/domain/*` (dont `chord-chart.ts`, 820 l.) | 3246 | **~493 (~15 %)** | **avec : 289 s** · **sans : >600 s non fini** |

- La densité de statiques **varie énormément** : 0 % dans un fichier de
  fonctions pures, ~15 % dans une zone de tables/parser. Un core TDD-strict est
  surtout des fonctions couvertes per-test — d'où le faux négatif de `chroma`.
- Là où ils existent, les statiques **plus que doublent** le temps et forment la
  **queue de timeouts** (un mutant statique déclenche des specs `WorkstationShell
  … (covered 0)` qui ne le couvrent pas). Extrapolé au full core (4247 mutants,
  ~2 h observées) : `ignoreStatic` coupe le run complet d'environ moitié et
  écrase les timeouts — ce qui rend un run à **cache froid survivable** sous le
  `timeout-minutes: 20` du job CI.

## Decisions

- **Garder Stryker sur la CI.** L'inquiétude « Stryker sur la CI est une mauvaise
  idée » venait d'un run à cache froid (mon `workflow_dispatch` accidentel sur
  une branche). Le design est sain : gaté hors PR, cache incrémental
  (`actions/cache`), `test:mutation:diff` borné en local avant PR. `ignoreStatic`
  répare le seul vrai trou (le coût des statiques à cache froid).
- **Base du score modifiée, assumé.** `ignoreStatic` sort les statiques du
  dénominateur. Ils sont joués contre *tous* les tests (bas signal, souvent
  survivants) : les retirer rend le score plus honnête et tend à le
  **maintenir/monter**, pas à le baisser sous `break: 90`. À confirmer sur le
  prochain run complet post-merge — non rejoué ici (~1 h).

## Gate status

- Config-only + doc. `stryker.config.json` : biome ✅ (JSON valide). Le job
  mutation ne tourne pas dans `pnpm gate` (post-merge/dispatch only) ; l'effet
  est mesuré ci-dessus, pas via la gate.
- Aucun code core/web touché → typecheck/tests inchangés.

## State to resume from

- **Single next action** : merger la PR. Au **prochain run complet post-merge**,
  vérifier le nouveau score de mutation (base sans statiques) reste ≥ 90 ;
  si un mutant statique tué disparaissait et faisait chuter le score, réévaluer.
- Gotchas :
  - `--incremental false` / `--no-incremental` n'existent pas en Stryker 9 :
    pour forcer un run complet, **supprimer `reports/stryker-incremental.json`**
    avant (le fichier est gitignoré, restauré en CI via `actions/cache`).
  - `--mutate "<glob>"` scope un run one-off à un fichier/dossier pour mesurer.
