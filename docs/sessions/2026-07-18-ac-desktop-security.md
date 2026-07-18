# Session — 2026-07-18 — ac-desktop-security

Lot AC de la [roadmap v6](../roadmap-excellence-6.md) (+ AI.1) : les trois 🟠
sécurité du shell desktop, en une PR (branche `feat/ac-desktop-security`).

## Done

- **AC.1 — yt-dlp pinné + sha256** (`download.rs`) : le bootstrap fetche la
  release **2026.07.04** (plus jamais `latest/`) et vérifie le sha256 de
  l'asset plateforme (constantes issues de SHA2-256SUMS) avant
  chmod/rename — `verify_sha256` refuse d'installer des octets non
  conformes. Fraîcheur inchangée (`-U` quotidien, hashes internes à
  yt-dlp). Bump = PR d'une constante (politique A.1). 2 tests Rust
  (vecteur NIST + refus).
- **AC.2 — capability fs + CSP** : deny scope explicite
  `$APPDATA/bin{,/**}` sur le plugin fs (le deny gagne — le webview ne peut
  plus réécrire le binaire que Rust exécute) ; CSP réelle à la place de
  `null` (`script-src 'self'`, connect https/localhost, blob pour
  audio/workers, `object-src 'none'`). `cargo check` valide la config.
- **AC.3 — deep link auth en PKCE** : client Supabase en
  `flowType: 'pkce'` ; `parseAuthCallback` n'accepte plus QUE
  `loupe://auth-callback?code=…` (URL épinglée, fragments implicites
  rejetés — des tokens ne s'installent plus jamais depuis une URL) ;
  `installDeepLinkAuth` échange le code (`exchangeCodeForSession`), inerte
  sans le verifier local → vol par hijack de schéma et login-CSRF
  neutralisés. Specs réécrites (8 cas).
- **AI.1 — CI Rust** : workflow `desktop.yml` path-filtré
  (`src-tauri/**`) : `cargo fmt --check` + `clippy -D warnings` +
  `cargo test` ; `rustfmt.toml` (indent 2) posé, fmt appliqué.

## Not done / remaining

- **Vérif en bundle à faire avant la beta desktop** : le PKCE de bout en
  bout (magic link → `?code=` → session dans le menu compte) n'a pas été
  rejoué en bundle Tauri cette session (recette T2.1bis : `tauri build
  --debug`). NB : le lien admin `generate_link` (dev) émet un fragment
  implicite — il ne loggue plus le shell PKCE, c'est voulu.
- « Signal UI au changement de session » (volet mineur AC.3) : le menu
  compte reflète déjà la session ; pas de toast dédié — à réévaluer si le
  besoin se confirme.
- Reste du lot : AE (headers/footers), AD, AF, AG, AH, AI.2.

## Decisions

- Politique binaire desktop = politique poids serveur : **version + sha256
  épinglés, jamais `latest/`** ; la fraîcheur passe par le self-updater de
  l'outil (qui vérifie ses propres hashes).
- Le webview ne doit **jamais** pouvoir écrire sous `$APPDATA/bin` —
  invariant posé en capability (deny scope), pas en convention.
- L'auth desktop ne lit **jamais** de tokens depuis une URL — PKCE
  seulement.

## Gate status

- `pnpm gate` : **vert** (exit 0) — 1914 tests web (+1 net : specs
  deep-link 8 cas).
- `cargo fmt --check` + `clippy -D warnings` + `cargo test` : verts (5/5).
- mutation (Stryker) : **skippé — zéro ligne de `@app/core` touchée**.

## State to resume from

- **Single next action** : Lot AE — headers/footers (AE.1 `.chromeBar` +
  font-size `s` par défaut dans les peaux, AE.3 label « Vitesse », AE.2
  densité footer — la partie restructuration 2 étages à checkpointer).
- Gotchas : le magic link doit désormais être ouvert par le même profil
  client qui l'a demandé (verifier local PKCE) ; `rustfmt.toml` fait foi
  pour l'indent Rust.
