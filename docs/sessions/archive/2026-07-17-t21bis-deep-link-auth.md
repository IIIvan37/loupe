# Session — 2026-07-17 — t21bis-deep-link-auth

## Done

- **T2.1bis — auth desktop par deep link, vérifié réellement.** Le magic link
  Supabase revient en `loupe://auth-callback#access_token=…` et la session
  s'installe dans le webview Tauri via `setSession` :
  - **Web (TDD)** : `auth/deep-link.ts` — `parseAuthCallback` pur (fragment →
    paire de tokens, rejette erreurs/fragments incomplets) +
    `installDeepLinkAuth(client, subscribe)` (première URL exploitable d'un
    batch → `setSession`) ; `auth/tauri-env.ts` (`isTauriShell` =
    `__TAURI_INTERNALS__` injecté par wry) ; `redirectTo()` de `create-auth`
    renvoie `loupe://auth-callback` sous le shell ; composition dans
    `appAuth()` (import dynamique de `@tauri-apps/plugin-deep-link`, jamais
    chargé sur le web pur).
  - **Desktop** : `tauri-plugin-deep-link` (Cargo + `.plugin(init())`),
    schéma `loupe` dans `tauri.conf.json`, capability `deep-link:default`.
  - **Supabase (API management)** : `site_url` corrigé `localhost:3000` →
    `http://localhost:5173`, `uri_allow_list` = `{http://localhost:5173,
    loupe://auth-callback}`.
  - **Vérif réelle** : bundle debug (`tauri build --debug --bundles app`),
    schéma présent dans l'Info.plist, lien admin `generate_link` → 303
    `loupe://auth-callback#…` → `open` → session visible dans le menu compte
    (e-mail + quota) — confirmé utilisateur.
- react-doctor : suppression scopée `artifact-baas-authority-surface` sur
  `dist/**` (l'artefact expose l'anon key + noms de RPC — public par design,
  frontières gardées par RLS/SECURITY DEFINER, vérifiées J2/U.3 ; le scan de
  dist est apparu parce que le build web existe désormais pour le bundle).

## Not done / remaining

- Origins Tauri (`tauri://localhost`) absents des trois allowlists → « Serveur
  hors ligne » attendu dans l'app bundlée ; prévu en **T2.5** (l'app en dev
  Tauri sur 5173 n'est pas affectée).
- Rate limit e-mail Supabase (~2/h sans SMTP custom) toujours à régler avant
  la beta.
- Suite de la Phase 2 : T2.2 (stores FS + `parseProject` au bord), T2.3
  (sidecar yt-dlp auto-actualisable), T2.4, T2.5.

## Decisions

- Le deep link installe la session par **`setSession()` explicite** — jamais
  par fragment d'URL (un hash seul ne recharge pas une page déjà ouverte).
- Piège macOS durable : le schéma custom ne s'enregistre **que via le bundle**
  (Info.plist/Launch Services) — `tauri dev` nu ne reçoit jamais le deep
  link ; vérifier avec `tauri build --debug`.

## Gate status

- typecheck: ✅ (`pnpm gate` exit 0)
- tests (with coverage): ✅ 1735 tests (+6 : 3 parse + 2 install + 1 redirect
  Tauri), couverture ~97 %
- mutation (Stryker, local, if core touched): **skippé — zéro ligne de
  `@app/core` touchée** (adapter web + desktop + config)
- biome / sheriff / knip / jscpd: ✅ ; react-doctor ✅ (1 suppression scopée
  documentée ci-dessus)

## State to resume from

- **Single next action** : ouvrir **T2.2** — stores filesystem Tauri à parité
  de contrat avec `projects.py` (dédup sha256, écritures atomiques, GC
  conservatif) + AA.2 `parseProject` au bord.
- Gotchas / half-done edits :
  - Tester le deep link = bundle obligatoire (`pnpm exec tauri build --debug
    --bundles app` dans packages/desktop, puis `open …/loupe.app`).
  - Un lien admin frais peut se générer sans e-mail :
    `POST /auth/v1/admin/generate_link` (service_role via
    `supabase projects api-keys`), chaque nouveau lien invalide le précédent.
  - Le bundle fige le dist : rebuilder `pnpm --filter @app/web build` avant
    `tauri build` pour embarquer les derniers changements web.
