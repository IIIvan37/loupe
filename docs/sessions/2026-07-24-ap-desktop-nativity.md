# Session — 2026-07-24 — Lot AP : nativité desktop (AP.2 + AP.3 + AP.4)

## Done

- **AP.2 — garde de fermeture native** (Rust `close_guard.rs` + web TDD, 7
  tests) : `CloseRequested` (croix rouge) **et** `ExitRequested` (⌘Q, Dock —
  qui ne passe jamais par CloseRequested) sont retenus et transmis au webview
  en événement `close-requested` ; le webview, propriétaire de l'état dirty,
  décide — session propre → `confirm_close` immédiat, sale → dialogue
  « Quitter sans enregistrer ? » (moule du drop-guard, face armée W.2), seul
  « Quitter » ouvre le verrou (`AtomicBool`, store avant destroy).
  **Protocole d'armement** (revue) : la garde ne retient les sorties
  qu'après `arm_close_guard`, invoqué par le webview une fois abonné — un
  React pas monté ou planté ne rend jamais l'app infermable, et un clic de
  fermeture au démarrage passe au lieu d'être avalé.
- **`QuitGuard`** : les deux gardes « quitter = perdre le travail » en un
  composant (beforeunload navigateur + chemin natif) ; le `beforeunload` est
  **coupé sous le shell** (le natif possède la question — pas de double
  prompt possible).
- **AP.3 — fenêtre native** : plugin `tauri-plugin-window-state`
  (taille/position/maximisé survivent aux relances, côté Rust seul) ; titre
  « <morceau> — Loupe » + point ● de travail non enregistré, `document.title`
  (onglet) + `setTitle` natif (TDD, 5 tests ; capability
  `core:window:allow-set-title` ajoutée). L'appel vit dans `ShellHeader` — la
  fenêtre reflète la ligne d'identité du header.
- **AP.4 — métadonnées** : `tauri.conf.json` bundle
  copyright/category(Music)/publisher ; `Cargo.toml`
  description/authors/license/repository.
- Revue 2 angles : armement (2 candidats majeurs corrigés), beforeunload
  gated, `exit_allowed`-sans-fenêtre confirmé « by design » (rien à garder
  avant la fenêtre), clone du dialogue jscpd-vert empiriquement.

## Not done / remaining

- **Replay bundle utilisateur** : croix rouge + ⌘Q, session propre (ferme
  direct) et sale (dialogue) ; géométrie de fenêtre après relance (le
  window-state sauve sur l'Exit — cache interne du plugin, à confirmer en
  vrai) ; titre natif avec ● après une édition.
- Titre non Lingui (`— Loupe`, ●) — assumé : app fr-only, le titre est une
  identité, pas une copy.

## Decisions

- **La garde n'existe qu'armée** : mieux vaut une fermeture non gardée dans
  la première seconde qu'une app infermable sur un webview mort.
- **⌘Q est gardé comme la croix** — un mac quitte au clavier ; ne garder que
  `CloseRequested` aurait laissé le trou principal.
- **beforeunload = repli navigateur seul**, coupé sous le shell.

## Gate status

- typecheck / tests (2110) / biome / sheriff / knip / jscpd / impeccable /
  react-doctor / tokens : ✅ (gate exit 0) ; `cargo check` ✅ (CI Rust fera
  clippy/fmt).
- mutation (Stryker) : non lancée — `@app/core` intouché.
- i18n : `quit.*` extraits (342 messages).

## State to resume from

- **Single next action** : ouvrir la PR `feat/ap-desktop-nativity` → `main` ;
  après merge, replay bundle (recette checklist :
  `pnpm --filter @app/desktop tauri build --debug --bundles app`), puis
  STATUS doc-only — **AP.2/3/4 livrées, Lot AP clos** (AP.1 l'était), reste
  le Lot AQ (copy) pour finir la roadmap v7.
- Gotchas : toute peau nouvelle du dialogue quitter partage le CSS du
  drop-guard ; un rechargement du webview (dev seulement) laisserait la
  garde armée sans listener — documenté dans `close_guard.rs`.
