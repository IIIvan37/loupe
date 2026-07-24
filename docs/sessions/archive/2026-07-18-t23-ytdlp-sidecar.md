# Session — 2026-07-18 — T2.3 import URL desktop (yt-dlp sous-process)

## Done

- **GO/NO-GO du wrapper Rust** : le crate `yt-dlp` (boul2gom, pisté depuis
  T2.1) est **GPL-3.0-only** (crates.io, v2.7.2) → NO-GO, il contaminerait la
  licence de l'app. Décision : piloter le **binaire yt-dlp directement en
  sous-process** (yt-dlp est Unlicense — l'invoquer n'impose rien), en gardant
  l'auto-actualisation (le point qui avait motivé la piste crate) via le
  self-updater intégré `yt-dlp -U`.
- **Commande Rust `download_track`** (`packages/desktop/src-tauri/src/download.rs`,
  3 tests unitaires) à **parité de gardes avec `server/app/download.py`** :
  allowlist d'hôtes (exact + sous-domaine dot-boundary — trust boundary
  re-vérifiée côté commande), budget wall-clock total 900 s, `--max-filesize
  500m`, `--socket-timeout 30`, un seul download à la fois. Le binaire n'est
  PAS bundlé (périme en semaines) : fetch dans l'app-data au 1er usage (borné
  `BINARY_FETCH_TIMEOUT`), self-update `-U` **fire-and-forget** au plus 1×/jour.
  Progrès streamé via un `Channel` Tauri (`downloading` fractionné →
  `transcoding 1.0`, comme le serveur).
- **Adapter web `createTauriTrackSource`** (`tauri-track-source.ts`, 6 tests)
  sur un seam `TauriDownloadBridge` (fake en test) ; binding humble
  `tauri-download-bridge.ts` (invoke + Channel + fs plugin, imports dynamiques,
  exclu de coverage). Factory `createTrackSource()` branchée sur
  `isTauriShell()` (motif T2.2).
- **Revue** (finder cleanup rentré ; A/B/C morts en panne de crédits → rejoués
  moi-même sur les points durs) → **fixes appliqués** :
  1. **course kill-par-pid** → `DownloadState` porte un signal d'annulation
     (`Notify`) ; `download_track` tue **son propre `Child`** via
     `tokio::select!` + `start_kill` (supprime `unsafe libc::kill`,
     `taskkill`, la dépendance `libc`, et le risque de tuer un pid réutilisé).
  2. **UI figée à zéro** pendant le bootstrap du binaire (~38 Mo) / le `-U` →
     progrès émis **avant** `ensure_binary`, self-update non bloquant.
  3. **dédup** : `toArrayBuffer` extrait en `lib/to-array-buffer.ts` (partagé
     avec `fs-project-store.ts`, +2 tests), mapping metadata extrait en
     `audio/track-metadata.ts` (partagé HTTP+Tauri — corrige la divergence
     null/undefined).
  4. **README registre** (ligne du port TrackSource) + **cross-refs allowlist**
     (core ↔ serveur ↔ Rust se pointent mutuellement).
  5. **Nettoyage temp robuste** : au lieu de dépendre d'un cleanup par-op qui
     peut rater (kill, crash), `sweep_orphan_downloads` balaie les dossiers
     temp orphelins **au début de chaque download** (un seul à la fois → au
     démarrage aucun temp légitime n'existe).
- **Vérifié réellement** dans le shell Tauri (macOS, 3 passes) : « Me at the
  zoo » importé (309 288 octets, `key of` metadata `{title, durationSeconds:19,
  artist:jawed}`, 12 events de progrès `downloading 0.00 → transcoding 1.00`) ;
  garde **vimeo.com refusée** (`unsupported source URL`) ; **annulation** à
  1,5 s → rejet propre `download cancelled`, slot libéré (download suivant OK) ;
  **sweep déterministe** : orphelin planté absent après un download normal,
  `downloads/` vide. Bootstrap du binaire au 1er lancement OK (38 Mo).

## Not done / remaining

- Le nettoyage par-op du dossier temp sur **annulation** peut laisser un résidu
  sur macOS (course flush post-SIGKILL) ; c'est **cosmétique** — le
  `sweep_orphan_downloads` du download suivant le récupère (vérifié). Pas de
  process orphelin (yt-dlp binaire = mono-process).
- ffmpeg non géré : `-f bestaudio[ext=m4a]/bestaudio` est un flux unique sans
  merge, donc pas de dépendance ffmpeg — si un jour un format mergé est visé,
  il faudra le sidecar ffmpeg (le crate écarté le gérait).
- UI inchangée : `useImportFromUrl` / `ImportMenu` marchent tels quels via le
  port (progrès + cancel déjà câblés). Pas de copy nouvelle.
- Suite : T2.4 migration `~/.loupe`, T2.5 retrait du serveur + origins Tauri.

## Decisions

- **Crate `yt-dlp` GPL-3.0 = NO-GO** ; sous-process du binaire yt-dlp
  (Unlicense) piloté par une commande Rust, auto-actualisable via `-U`.
- **Binaire non bundlé**, fetché dans l'app-data au 1er usage, `-U` 1×/jour
  fire-and-forget (fraîcheur best-effort, jamais bloquant).
- **Annulation par kill du `Child` propre** (signal `Notify` partagé), jamais
  par pid brut.
- **Nettoyage temp par sweep au démarrage du download** (backstop robuste),
  pas seulement par-opération.
- Allowlist d'hôtes désormais en **3 copies** (core / serveur / Rust), chacune
  pointant les deux autres — trust boundary à chaque frontière.

## Gate status

- typecheck: ✅ (via `pnpm gate`, exit 0)
- tests (with coverage): ✅ **1824 web** (+~20), coverage 97,3 %
- Rust: ✅ `cargo test` 3/3, `cargo clippy` propre
- mutation (Stryker, local): **skippé** — cœur pur `@app/core` intouché (le
  seul fichier core touché est un commentaire dans `supported-source.ts`)
- biome / sheriff / knip / jscpd / react-doctor / impeccable: ✅

## State to resume from

- **Single next action** : ouvrir la PR T2.3 (branche `feat/t23-ytdlp-sidecar`),
  puis **T2.4** (migration des projets `~/.loupe` → app-data Tauri au 1er
  lancement, copie + vérif sha256, original intact).
- Gotchas / half-done edits :
  - Vérif réelle : web sur **5173** puis `pnpm --filter @app/desktop dev` ; le
    protocole self-test (fichier temp importé de main.tsx écrivant un rapport
    dans l'app-data) est retiré du worktree, rien à nettoyer.
  - Le binaire yt-dlp vit sous `<app-data>/bin/yt-dlp` (38 Mo, gitignoré de
    fait — hors repo) ; `.last-update-check` marque le dernier `-U`.
  - En dev macOS, le schéma custom `loupe://` ne s'enregistre qu'en bundle
    (rappel T2.1bis) — sans rapport avec l'import URL qui marche en `tauri dev`.
  - Les 3 S8980 FP de `use-separation.spec.tsx` restent à marquer « faux
    positif » dans l'UI SonarCloud (pas d'auth API côté agent).
