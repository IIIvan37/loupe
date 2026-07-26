# Session — 2026-07-26 — ts6-docs-link-checker

## Done

- **TS.6 — link-checker des living docs** (PR #263, branche
  `feat/ts6-docs-link-checker`) : adoption du bloc « living docs name only
  paths that exist » du template dans `docs/docs.spec.ts`. Les docs vivants
  (README, CLAUDE.md, skills, STATUS, index ADR, registre application,
  `server/README.md`) ne peuvent nommer que des chemins existants ; les
  documents datés (sessions, corps d'ADR) restent exempts.
- Adaptations Loupe : `KNOWN_ROOTS` + `server`/`supabase` ; skip du walk
  étendu aux répertoires lourds (`.venv`, `__pycache__`, `.pytest_cache`,
  `.ruff_cache`, `target`, `.stryker-tmp`, `.temp`, `.branches`, `dist`) ;
  fixtures du détecteur réécrites sur des chemins Loupe (plus de
  `packages/cli`).
- Drift trouvé et corrigé : un seul chemin mort — le placeholder
  `packages/web/src/...` de la skill `new-feature-hexa` (reformulé avec un
  trailing slash). Les living docs étaient sains par ailleurs.
- **Clôture du plan TS** : Suivi TS.1–TS.6 tout ✅ →
  `template-sync-plan.md` archivé sous `docs/archive/` dans cette PR ;
  rapport ts5-4 roulé vers `sessions/archive/`.

## Not done / remaining

- Reliquats notés au plan (hors lot, différés) : `timecode` attend un second
  consommateur avant promotion ; nursery restante ≈ transport (candidat noté
  au rapport ts5-8) + `detect-chords`/`bass-line` à dessein.
- Reste dû côté AP : replay bundle utilisateur (croix rouge/⌘Q propre et
  sale, géométrie maximisée après relance, titre natif avec ●).

## Decisions

- `livingDocs()` inclut `server/README.md` (doc vivant du serveur dev/CI) —
  ajout par rapport à la liste du template.
- Plan clos = plan archivé **dans la PR qui le clôt** (même logique
  merge-invariante que STATUS/Suivi).

## Gate status

- typecheck: ✅
- tests (with coverage): ✅ (docs.spec.ts 35/35 ; couverture globale ~96,8 %
  statements)
- mutation (Stryker, local, if core touched): **skippé — aucun fichier
  `@app/core` touché** (spec docs racine + un SKILL.md).
- biome / sheriff / knip / jscpd: ✅ (`pnpm gate` exit 0)

## State to resume from

- **Single next action**: merger PR #263, puis attaquer le **Lot AQ**
  (vocabulaire/copy : AQ.1 lexique « Piste », AQ.2 anglais brut + ton) de
  la roadmap v7.
- Gotchas / half-done edits : le link-checker tourne dans `docs.spec.ts` à
  chaque `pnpm test`/gate — tout nouveau doc vivant qui nomme un chemin
  inexistant fera échouer la suite ; les exemples hypothétiques ne doivent
  pas ressembler à de vrais chemins (placeholders `<feature>`, `…` unicode
  ou backtick sans forme de chemin). **Piège attrapé en CI** : un chemin
  gitignoré (le `.venv` du serveur) existe localement mais pas en CI — le
  check est dépendant de l'environnement pour les artefacts machine-local ;
  ne jamais nommer un chemin gitignoré hors bloc fencé (leçon starter à
  récolter : ne compter que les fichiers trackés). `.github/copilot-instructions.md`
  untracked présent dans le worktree (pas à moi, laissé tel quel).
- Le job CI « Dependency audit » échoue **aussi sur main** : le endpoint
  audit du registry npm ne passe plus avec pnpm 10.11.0 épinglé
  (« not valid JSON », reproduit localement) ; vérifié OK avec pnpm 11.17.0
  (1 moderate < seuil high) → bump `packageManager` dans une PR dédiée.
