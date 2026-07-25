# Session — 2026-07-24 — ts4-testing-subpath

## Done

- **Subpath `@app/core/testing` câblé de bout en bout**
  ([ADR-0002](../adr/0002-contrats-de-ports-en-subpath-testing.md), désormais
  « en vigueur ») :
  - `packages/core/package.json` : export `./testing` →
    `src/testing/index.ts` (barrel, hors `src/index.ts`).
  - `tsconfig.json` : path `@app/core/testing` (load-bearing pour Sheriff,
    comme `@app/core`).
  - `sheriff.config.ts` : entry point `core-testing` (les specs sont
    invisibles pour Sheriff — sans lui le sous-arbre testing ne serait jamais
    vérifié), module `core:testing` (→ domain + application ; aucune règle ne
    l'accorde à personne).
  - `biome.json` : override `packages/web/src/**` (hors `*.spec.ts{,x}`)
    interdisant l'import de `@app/core/testing` en code de prod.
  - `vitest.config.ts` : alias en **forme tableau** — l'entrée subpath doit
    précéder `@app/core`, sinon le prefix-match la mangle en
    `index.ts/testing`.
  - `stryker.config.json` : `!packages/core/src/**/testing/**` (muter un
    contrat de test = mutants survivants garantis ; aligné template).
- **Premier contrat de port : `ProjectStore`** (TDD rouge → vert) :
  - `packages/core/src/testing/project-store-contract.ts` — 8 obligations,
    uniquement ce dont le core dépend (`load` inconnu → `undefined`, save =
    upsert, round-trip, `list` **sans promesse d'ordre** — `listProjects` trie
    lui-même, delete idempotent, non-mutation de l'entrée). Fixture avec
    `audioRef` sha-256 hex 64 (valeurs du contrat réel, cf. leçon PR #209).
  - `in-memory-project-store.ts` — fake de référence
    (`createInMemoryProjectStore`), rejoué par le contrat dans
    `project-store-contract.spec.ts`.
  - `packages/web/src/projects/fs-project-store.spec.ts` rejoue le même
    contrat sur `createFsProjectStore` via `@app/core/testing` — la preuve
    cross-package du câblage.
  - Convergence : le `fakeProjectStore` hand-rollé de
    `core/src/application/projects.spec.ts` supprimé, remplacé par le fake de
    référence (import relatif côté core).
- **Garde-fous prouvés par injection** (puis revert) : import de
  `@app/core/testing` dans `create-project-stores.ts` → Biome
  `noRestrictedImports` rouge ; ré-export du testing depuis `src/index.ts` →
  Sheriff `core:api → core:testing` rouge.
- Rotation sessions : `2026-07-24-ap-desktop-nativity.md` → `archive/` (borne
  ≤ 5 actifs).

## Not done / remaining

- Les ~23 autres ports de `ports.ts` : chaque extraction TS.5 emporte *ses*
  contrats et *ses* fakes (pas de big bang, conforme ADR-0002). Candidat
  naturel suivant si besoin avant TS.5 : `ProjectAudioStore` (le
  `fakeAudioStore` de `projects.spec.ts` et l'adapter fs existent déjà).
- `failingStore` / `fakeAudioStore` restent hand-rollés dans
  `projects.spec.ts` (scénarios d'échec + port non couvert) — volontaire.

## Decisions

- Fake de référence = **fonction factory** (`createInMemoryProjectStore`),
  idiome loupe (`createFsProjectStore`), pas les classes du template ; il
  expose `saved: Map` pour l'assertion directe, même surface que l'ancien
  fake des specs (convergence drop-in).
- Le contrat n'exige **aucun ordre** sur `list` : l'obligation d'ordre
  appartient à `listProjects` (tri `updatedAt` côté use-case), pas au port.
- Alias vitest passés en forme tableau (raison dans le commentaire du
  fichier) — toute future entrée subpath devra rester avant `@app/core`.

## Gate status

- typecheck : ✅
- tests (with coverage) : ✅ 162 fichiers, 2314 tests (dont contrat ×2 :
  référence in-memory + adapter fs)
- mutation (Stryker, local, `--force`) : ✅ 92,70 % (seuil break 90) —
  `testing/**` exclu du scope muté
- biome / sheriff / knip / jscpd : ✅ (gate complète verte ; les deux
  garde-fous du subpath vérifiés par injection)

## State to resume from

- **Single next action** : ouvrir la PR TS.4, puis attaquer **TS.5.1
  (mécanisme)** : règles placeholder Sheriff
  `core/src/<feature>/{domain,application,testing}`, ratchet nursery,
  `scripts/modules-hint.ts` — cf.
  [template-sync-plan.md](../template-sync-plan.md).
- Gotchas : dans le core, importer les fakes en **relatif**
  (`../testing/...`), jamais via le subpath (self-import) ; le tag Sheriff du
  template pour les testing par feature (`layer:testing`) arrivera avec les
  placeholders TS.5, inutile avant.
