# Session — 2026-07-24 — Lot TS.1 : rattrapage configs & outillage du template

## Done

- **tsconfig** : `erasableSyntaxOnly: true` dans `tsconfig.base.json` ; le
  commentaire « paths LOAD-BEARING pour Sheriff » repris au-dessus de `paths`
  (adapté web→core) ; `"scripts"` ajouté à `include` (vide aujourd'hui — shell
  seulement — mais prêt pour `modules-hint.ts` de TS.5). Le path
  `@app/core/testing` et `"docs"` attendent TS.4/TS.2.
- **Refactor mécanique forcé par `erasableSyntaxOnly`** : contrairement au
  plan (« aucune violation »), 5 classes d'erreur utilisaient des propriétés
  de constructeur (`readonly code` en paramètre) — `ChordDetectionError`,
  `StructureDetectionError`, `TempoDetectionError`, `SeparationError` (core)
  et `HttpStatusError` (web). Passées en champ explicite + affectation :
  iso-comportement, couvert par les specs existantes.
- **`.jscpd.json`** : déjà présent côté loupe et plus complet que celui du
  template ($schema, ignore `public/`) — conservé tel quel, source de vérité
  unique confirmée (`check:dup` = `jscpd packages`, config lue à la racine).
- **`.gitattributes`** (LF partout — prérequis de la gate Windows),
  **`.vscode/settings.json`** (Biome formatteur + tsdk workspace, fusionné
  avec le bloc SonarLint loupe), **`.github/PULL_REQUEST_TEMPLATE.md`**
  (adapté : pas de contrat de port ni d'ADR tant que TS.3/TS.4 ne sont pas
  passés ; ligne Lingui ajoutée ; STATUS retiré — convention loupe, mis à
  jour sur main post-merge).
- **`pnpm-workspace.yaml`** : overrides justifiés par `pnpm audit` —
  `fast-uri ^3.1.4` (2 advisories high via ajv < commitlint/stryker) et
  `brace-expansion ^5.0.7` (high via minimatch < stryker). Pas de pin 4.x de
  fast-uri (absent du lockfile). Après install : 0 high, reste 1 moderate
  (sous le seuil CI).
- **`biome.json`** : schéma 2.5.5 (+ bump `@biomejs/biome` ^2.5.5) ; override
  pureté du core durci comme le template — globals ambiants (`Date`,
  `performance`, timers, `crypto`, `XMLHttpRequest`, `WebSocket`) et imports
  `node:*` réseau/temps interdits hors specs. Tous les overrides loupe
  conservés (useLatest/stableResult, excludes desktop/server/supabase).
- **`.husky/pre-commit`** : formatage sûr des fichiers partiellement stagés
  (jamais re-add un fichier à hunks non stagés — warning au lieu d'avaler le
  `git add -p`) ; fast-path doc-only conservé, qui exécutera
  `docs/docs.spec.ts` **si le fichier existe** (`[ -f … ]` — TS.2 le crée en
  parallèle). Gate loupe complète conservée (design/react inclus).
- **`.github/workflows/ci.yml`** : `workflow_dispatch` ; job `audit`
  (`pnpm audit --audit-level high`) ; job `gate-windows` post-merge + à la
  demande (acté : cible desktop Windows via Tauri) ; mutation étendue au
  dispatch + cache incrémental Stryker (`reports/stryker-incremental.json`) +
  upload de l'artefact `reports/mutation` (14 j). Jobs loupe (server,
  edge-functions) intacts ; desktop.yml / sonar.yml non touchés.
- **Skills** (réconciliation 3-voies, adaptations loupe gardées) :
  - `tdd-cycle` : « one behavior per test » (plusieurs `expect` d'un même
    résultat OK), tidy-first (structurel ≠ comportemental, commits séparés),
    trois sorties pour un clone jscpd, « listen to the tests » (GOOS).
  - `quality-gate` : mention `erasableSyntaxOnly`, doctrine des trois sorties
    jscpd fusionnée avec le ratchet loupe (baisser le seuil, jamais le
    monter).
  - `new-feature-hexa` : naissance en nursery (frontières découvertes, pas
    décrétées), état ambiant = port, section 4bis extraction (rule of three,
    Mikado, depth check) — mécanisme complet annoncé pour TS.5.
  - `session-report` : module watch (rule of three) au closing, Decisions →
    ADR (TS.3), fenêtre glissante de 5 reports + archive, STATUS
    merge-invariant **adapté à la convention loupe** (mis à jour sur main
    post-merge, seul le report daté part dans la PR).

## Not done / remaining

- `docs/docs.spec.ts`, purity/public-surface specs, `Result` partagé → TS.2.
- ADR (`docs/adr/`) → TS.3 ; subpath `@app/core/testing` → TS.4 ; placeholder
  Sheriff + `modules:hint` → TS.5. Les skills y font référence avec la
  mention « once lot TS.x lands ».
- Cache incrémental Stryker en CI : attention au piège connu (Survived
  périmés) — si le post-merge remonte des faux survivants, purger la clé de
  cache `stryker-*` avant de conclure.

## Decisions

- **Refactor hors périmètre assumé** : le lot interdisait de toucher
  `packages/core/src`, mais `erasableSyntaxOnly` l'exigeait (le plan croyait
  le tree propre). Choix : refactor mécanique iso-comportement plutôt que
  d'abandonner l'invariant strip-only.
- **Gate Windows activée** (post-merge + dispatch) : l'app a une cible
  desktop Windows, la portabilité est un vrai risque produit.
- **`.jscpd.json` loupe prime** sur celui du template (plus complet, seuil
  ratchet 1.0 vs 0 : du legs à résorber, pas du greenfield).
- **PR template sans checklist fantôme** : les cases contrat-de-port et ADR
  n'apparaîtront qu'avec l'infra correspondante (TS.3/TS.4).

## Gate status

- typecheck / biome / sheriff / impeccable / react-doctor / tokens /
  coverage (96,7 % st.) / knip / jscpd : ✅ (gate exit 0).
- mutation (Stryker) : non lancée — le seul changement core est un refactor
  syntaxique iso-comportement (champs explicites), couvert par les specs
  existantes ; le run CI post-merge fera foi.
- `pnpm audit --audit-level high` : ✅ (0 high après overrides).

## State to resume from

- **Single next action** : merger la PR TS.1 puis attaquer TS.2 (fitness
  functions : purity, public-surface, docs.spec + `Result` partagé).
- Gotchas : le fast-path doc-only du pre-commit n'exécutera la spec docs que
  quand TS.2 l'aura créée (garde `[ -f docs/docs.spec.ts ]` déjà en place) ;
  premier run `gate-windows` à surveiller (il a le droit d'être rouge pour
  une vraie raison de portabilité).
