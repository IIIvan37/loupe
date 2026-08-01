# Session — 2026-08-01 — Lot AT : les filets reviennent

## Done

- **AT.1 — CI Rust recréée** : `rust.yml`, l'ancien `desktop.yml` (récupéré
  de l'historique) sans la partie Tauri — fmt `--check`, clippy
  `-D warnings`, `cargo test --workspace` + leg Windows, path-filtré
  `crates/**`/`Cargo.*`/`rustfmt.toml`. Vérifié en local : fmt/clippy verts,
  22 tests passent. `beta-checklist.md` « [x] CI Rust » redevient vrai.
- **AT.2 — La release exige le vert** : le job `verify` de `release.yml`
  interroge les workflow runs du commit tagué (dernier run par workflow,
  Release exclu pour ne pas s'auto-bloquer) et échoue si le run CI manque ou
  si un run n'est pas conclu vert — tagger juste après un merge = attendre le
  run mutation. Côté visibilité : job `notify-red-main` dans `ci.yml` — un
  échec du tier post-merge sur main ouvre (ou commente) une issue
  `ci-main-rouge`.
- **AT.3 — Release rejouable + rappel PAT** : `gh release view … ||
  gh release create` puis `upload --clobber` ; push tap sans-op si la formule
  n'a pas changé. `pat-reminder.yml` (cron lundi) ouvre une issue
  `pat-renouvellement` à J-21 de `TAP_TOKEN_EXPIRES` (2026-08-31) ;
  procédure de renouvellement documentée dans `docs/RELEASING.md`.
- **AT.4 — Chaîne release durcie** : le secret `HOMEBREW_TAP_TOKEN` descend
  au `env:` de la seule step « Push formula » (le job ne garde qu'un booléen
  de présence) ; toutes les actions de `release.yml` + les actions tierces de
  `rust.yml` épinglées par SHA (rust-toolchain vit sur une branche mouvante) ;
  attestation de provenance (`actions/attest-build-provenance`) sur `dist/*`.
- **🟢 check:shell dans le gate** : `scripts/check-shell.ts` — shellcheck
  **système** (préinstallé sur tous les runners GitHub ; message
  d'installation clair sinon) sur les 10 scripts shell trackés (scripts/,
  .claude/hooks/, .husky/) + actionlint officiel (`github-actionlint`,
  `adm-zip` forcé ≥0.6.0 via `pnpm.overrides`) sur les 5 workflows. Câblé
  dans `gate`, le hook pre-commit et donc CI. 4 findings shellcheck initiaux
  traités par directives ciblées justifiées (source nvm dynamique ×2, split
  volontaire ×2).
- **🟢 Purge vitest.config.ts** : les 8 exclusions de couverture mortes
  (globs `**/audio/*.ts` cassés par le déplacement #323 vers
  `audio/playback|http|encode`) supprimées — elles n'excluaient plus rien et
  les seuils passent avec ces fichiers comptés.
- **🟢 En-tête formule brew** : la génération ne substitue plus les
  placeholders du commentaire d'en-tête du template (elle ne garde que
  `class Loupe` et préfixe un en-tête « generated — do not edit »).
- **🟢 Inventaire Sonar → Veille** : les 8 issues assumées listées dans la
  Veille du STATUS (S3776 `use-chord-detection.ts:172` en tête).

## Not done / remaining

- Le premier vrai passage de `verify` (AT.2) et de `pat-reminder.yml` ne se
  verra qu'au prochain tag / prochain lundi — logique testée à blanc
  seulement (actionlint vert, pas de dry-run GitHub possible).
- Le wasm npm `actionlint` (2.0.6) a été essayé puis écarté : périmé (ne
  connaît ni `macos-14` ni la permission `attestations`) —
  `github-actionlint` (1.7.12, binaire officiel) retenu à la place.
- Le wrapper npm `shellcheck` a lui aussi été essayé puis écarté : il a fait
  tomber le Dependency audit de la PR (decompress, critique GHSA-mp2f-45pm-3cg9,
  **sans version corrigée** + 3 moderates) — remplacé par le shellcheck
  système ; `adm-zip` (high via github-actionlint) corrigé par
  `pnpm.overrides` ≥0.6.0.

## Decisions

- **Le gate s'étend à la couche shell** : shellcheck + actionlint deviennent
  des détecteurs bloquants. L'hermétique-npm a cédé devant l'audit (le
  wrapper `shellcheck` embarque un critique non corrigé) : shellcheck est un
  outil système assumé, actionlint reste npm. Faux positifs traités par
  directive au site, jamais par baisse de sévérité globale.
- **La release refuse un main non vert** — le design D5 « le tag fait foi »
  reste, mais verify vérifie désormais ce que le tagueur affirmait sur
  l'honneur (leçon v0.1.0 : tier autoritaire rouge du 26/07 au 01/08 sans
  que personne ne le voie).
- Exclusion de couverture morte = mensonge : purge plutôt que re-pointage
  (les seuils passent avec les fichiers comptés).

## Gate status

- typecheck : ✅ · biome / sheriff / knip / jscpd : ✅ (knip :
  `ignoreDependencies` pour les 2 wrappers npm résolus via `require.resolve`)
- tests (with coverage) : ✅ 2425 tests, seuils tenus avec les 8 fichiers
  audio réintégrés au métrique
- check:shell : ✅ 10 scripts + 5 workflows
- mutation (Stryker) : **skippé — aucun fichier `@app/core` touché** (lot
  CI/outillage pur)
- Sonar : quality gate OK sur main, 8 issues assumées (inventoriées en
  Veille) ; l'analyse de cette PR arrive ~5 min après le push
- cargo fmt/clippy/test : ✅ en local (22 tests)

## State to resume from

- **Single next action** : Lot AU — le tempo et la séparation se parlent
  (AU.1 : siéger le click dans le mix séparé quel que soit l'ordre
  tempo/séparation), depuis un main à jour après merge de la PR #335.
- Gotchas : au premier tag v0.2, prévoir le délai du run mutation post-merge
  avant que `verify` passe ; si le numéro de PR n'est pas #335, corriger
  STATUS/Suivi avant merge.
