# Session — 2026-07-17 — t21-spike-tauri-go

## Done

- **Évaluation pré-spike** (avant d'engager T2.1) : l'import URL est acté
  fonctionnalité principale → l'option PWA+OPFS est écartée ; choix réduit à
  Tauri vs Electron ; Tauri confirmé premier candidat, **Electron acté comme
  fallback en cas de NO-GO** ; multi-plateforme confirmé (Linux cible,
  rendu/packaging WebKitGTK dérisqué par l'expérience pixsaur). Consigné dans
  [client-leger-plan.md](../client-leger-plan.md) § T2.1 (commit `d57f24b`
  doc-only sur `main`).
- **Spike T2.1 — verdict GO, vérifié réellement** : coquille Tauri 2 dans
  `packages/desktop` (scaffold `tauri init`, shell web inchangé servi par Vite
  5173, macOS/WKWebView). Passés sur vraie musique : import fichier (drag &
  drop) et import URL (yt-dlp), lecture, time-stretch SoundTouch en
  AudioWorklet, session/localStorage, **et les trois cas durcis WebKit** —
  lecture fenêtre minimisée ~1 min, 6 stems + time-stretch prolongé,
  changement de périphérique de sortie en cours de lecture.
- **Inventaire licences : aucun bloquant.** Rubber Band n'est PAS dans le code
  (crainte périmée) ; le stretcher livré est SoundTouchJS **MPL-2.0** (pas le
  C++ LGPL). Reste MIT/ISC/BSD/Apache, fontes OFL-1.1, caniuse-lite CC-BY-4.0.
  Pas de GPL/LGPL → App Store non bloqué par les licences.
- Outillage : `biome.json` + `knip.json` ignorent
  `packages/desktop/src-tauri/{target,gen}` (artefacts de build Rust).
- Ménage : 36 projets de test « take » (résidus des vérifs M1.x) supprimés du
  serveur local.

## Not done / remaining

- T2.1bis (nouveau, trouvaille du spike) : auth desktop par deep link
  `loupe://auth-callback` (`tauri-plugin-deep-link` + `setSession()`
  explicite — le magic link s'ouvre dans le navigateur par défaut, jamais dans
  le webview ; et un fragment d'URL ne redéclenche pas de chargement si l'app
  est déjà sur la même page).
- La coquille est un spike nu : pas de menu macOS (pas de Cmd+R/raccourcis),
  identité/icônes par défaut, pas de CI desktop.
- Rate limit e-mail Supabase (~2/h sans SMTP custom) : SMTP custom ou OTP à
  poser avant la beta.
- T2.2 à T2.5 inchangés (stores FS, sidecar yt-dlp, migration `~/.loupe`,
  retrait du serveur).

## Decisions

- **GO Tauri** (les trois cas durcis passés) ; Electron reste le fallback
  documenté au cas où un mur WebKit surgirait plus tard.
- `dragDropEnabled: false` obligatoire dans la conf fenêtre, sinon Tauri
  intercepte le drag & drop et le HTML5 DnD n'atteint jamais le webview.
- Sidecar T2.3 : le binaire yt-dlp doit être **auto-actualisable à
  l'exécution** (vécu en séance : extracteur périmé en 3 semaines, 2026.6.9 →
  2026.7.4) ; piste crate `yt-dlp` (boul2gom). rustube et les
  réimplémentations natives écartées (toujours en retard d'un cassage,
  YouTube-only).

## Gate status

- typecheck: ✅ (via `pnpm gate`, exit 0)
- tests (with coverage): ✅ 97,24 % statements / 92,35 % branches
- mutation (Stryker, local, if core touched): **skippé — zéro ligne de
  `@app/core` touchée** (docs + scaffold desktop + config outillage)
- biome / sheriff / knip / jscpd: ✅ (après exclusion des artefacts Rust dans
  biome/knip)

## State to resume from

- **Single next action** : ouvrir T2.1bis (deep link auth) ou T2.2 (stores
  filesystem — le cœur de « les projets restent locaux », absorbe AA.2
  `parseProject` au bord).
- Gotchas / half-done edits :
  - Lancer la coquille : `pnpm --filter @app/web dev` (5173 obligatoire —
    allowlist d'origines) puis `pnpm --filter @app/desktop dev`.
  - Pas de Cmd+R dans la fenêtre : relancer en touchant
    `src-tauri/tauri.conf.json` (tauri dev redémarre l'app).
  - En dev, la session Supabase peut s'installer via la console devtools
    (clic droit → Inspect Element) : poser le fragment `#access_token=…` PUIS
    `location.reload()`.
