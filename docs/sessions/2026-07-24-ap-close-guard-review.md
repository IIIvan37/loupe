# Session — 2026-07-24 — Revue post-clôture Lot AP (garde de fermeture)

## Done

- **Revue 2 finders sur le diff mergé de #249** (AP.2–AP.4) : un angle Rust
  (`close_guard.rs` + câblage + capabilities, vérifié contre la source de
  `tauri-plugin-window-state` 2.x), un angle web (hooks/composants du
  workstation-shell). 10 candidats, 5 retenus, 5 écartés (documentés
  ci-dessous).
- **Fix web — race d'armement** (`use-close-guard.ts`) : `install()` ne
  revérifiait pas `disposed` entre la résolution de `listen` et
  l'`invoke('arm_close_guard')` — un démontage dans cette fenêtre armait la
  garde sans listener (app infermable). Garde `disposed` ajouté avant
  l'armement, épinglé par un test rouge d'abord (« never arms the shell when
  the unmount lands mid-install », interleaving contrôlé par un `listen`
  différé + un seul tour de microtasks).
- **Specs renforcés** (trous de test, pas de bug de comportement) :
  - `use-window-title.spec.ts` : le `beforeEach` pré-remplissait
    `document.title` avec la valeur attendue du fallback — test vide ;
    remplacé par une sentinelle, le fallback est maintenant prouvé.
  - `use-close-guard.spec.ts` : le nom du canal `close-requested` (contrat
    Rust `CLOSE_REQUESTED`) n'était affirmé nulle part — une typo laissait
    la garde morte avec tous les specs verts ; épinglé.
- **Fix Rust — persistance maximized/fullscreen sur ⌘Q** (`confirm_close`) :
  le plugin window-state ne capture ces flags que sur `CloseRequested` —
  jamais émis sur le chemin ⌘Q gardé (destroy direct) ; à l'`Exit` la
  fenêtre est déjà morte. `save_window_state(StateFlags::all())` explicite
  avant `destroy`, fenêtre encore vivante. (Le chemin croix rouge était
  sain — asymétrie facile à rater en test.)
- **Fix Rust — `destroy()` en échec** : le verrou `exit_allowed` était posé
  avant `destroy` (ordre requis par l'`ExitRequested` qui suit) mais jamais
  rendu si `destroy` échouait — app toujours ouverte, garde définitivement
  morte. Le verrou est rendu sur `Err`.
- Hygiène : 3 worktrees d'agents des lots TS mergés retirés (leurs
  `biome.json` cassaient le gate en racines imbriquées), branches locales
  TS supprimées.

## Not done / remaining

- **Replay bundle utilisateur** (hérité du rapport AP, toujours dû) : croix
  rouge + ⌘Q propre/sale ; **géométrie maximisée après ⌘Q gardé** (le fix de
  cette session, à confirmer en vrai) ; titre natif avec ●.
- Candidats écartés, assumés :
  - Webview qui meurt **après** armement (crash du process WKWebView) →
    app infermable jusqu'au force-quit : pas d'événement de crash exposé
    par Tauri ; limite documentée dans l'en-tête de `close_guard.rs`
    (élargie au-delà du seul reload dev). Un vrai fix demanderait un
    ack/watchdog côté webview — à ouvrir seulement « si ça mord ».
  - Hypothèses mono-fenêtre de la garde (état global, émission broadcast,
    label `main` en dur) : latent, aucun produit à 2 fenêtres.
  - `confirmClose` fire-and-forget sans catch : un échec d'invoke =
    capability cassée, visible en dev.
  - Fenêtre `useLatest` sub-frame sur le flag dirty : idiome sanctionné du
    repo.

## Decisions

- **La garde se rend sur un `destroy` raté** : mieux vaut re-demander une
  confirmation de trop que laisser tous les exits suivants passer sans
  garde.
- **La sauvegarde window-state est explicite sur le chemin gardé** — on ne
  dépend pas des événements que le plugin n'aura jamais.

## Gate status

- typecheck / biome / sheriff / tests (2290, coverage 96,7 % st.) / knip /
  jscpd / impeccable / react-doctor / tokens : ✅ (gate exit 0).
- `cargo fmt --check` + `cargo clippy` : ✅ silencieux.
- mutation (Stryker) : non lancée — `@app/core` intouché.
- i18n : aucune copy changée, pas d'extract.

## State to resume from

- **Single next action** : merger la PR de `fix/ap-close-guard-review`, puis
  mettre à jour `docs/STATUS.md` sur `main` (commit doc-only) — il annonce
  encore « Prochain : Lot AP ou AQ » alors qu'AP est livré (#249 + cette
  revue) ; décision : **finir le lot TS d'abord** (TS.4 puis TS.5,
  [template-sync-plan.md](../template-sync-plan.md)), le Lot AQ
  (vocabulaire et copy) vient après.
- Gotchas : le replay bundle utilisateur du Lot AP n'a toujours pas été
  fait ; `.github/copilot-instructions.md` traîne non suivi dans l'arbre
  (pas à moi, laissé hors commit).
