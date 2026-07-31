# Checklist beta — garde-fous et vérifications

> État au **2026-07-31**, après le serveur unique (PR #328). **Tous les
> garde-fous sont soldés** — il ne reste que l'item optionnel D6 (allowlist
> redirect `127.0.0.1:6173`, inutile pour l'OTP).

## Actions opérateur (soldées le 2026-07-31)

- [x] **Redeploy Modal** — **FAIT ET VÉRIFIÉ (2026-07-31)** : défaut
  d'origins sans `tauri://` (#327) + arbre `server/` rétréci (#328) en ligne.
  Préflight curl : `Origin: http://localhost:5173` → écho allow-origin,
  `Origin: tauri://localhost` → 400 sans écho.
- [x] **Redeploy Edge Function** — **FAIT ET VÉRIFIÉ (2026-07-31)** : même
  contrôle préflight (5173 échoïsé, `tauri://` 204 sans écho — le navigateur
  bloque).
- [x] **Re-seed des codes beta legacy < 32 chars** — **FAIT (2026-07-31)** :
  inventaire = un seul legacy (`FRIENDS`, 24 restants) ; opérateur seul
  utilisateur → purge sans redistribution. Gotcha : la FK
  `beta_members_code_fkey` (sans cascade) bloque le delete d'un code déjà
  utilisé — insérer le code frais, **re-pointer `beta_members`**, puis
  supprimer le legacy (séquence dans le runbook U.3). Le code frais
  (`gen_random_uuid()`, note `re-seed U.3 2026-07-31`) est noté côté opérateur.

## À faire par l'utilisateur (non automatisable)

- [x] **Plafond de dépense Modal** — **RÉGLÉ PAR LE PLAN (2026-07-19)** : le
  compte est en free plan, plafonné nativement à **30 $/mois** — aucun spend
  cap à poser tant qu'on n'upgrade pas. Référence : dépense mesurée
  ≈ 3,67 $/mois tout développement inclus (10× de marge). À re-vérifier
  seulement si le compte passe payant.
- [x] **SMTP custom Supabase** — **FAIT (2026-07-19)** : Resend sur le
  domaine `iiivan.org` (déjà vérifié SPF/DKIM), expéditeur
  `loupe@iiivan.org`, posé au Dashboard (Auth → SMTP : `smtp.resend.com`,
  465, user `resend`, pass = clé API restreinte à l'envoi, stockée hors
  dépôt dans `~/.loupe-secrets/resend.key`) + rate limit e-mail monté à
  ~30/h. Vérifié réellement : envoi API Resend direct OK, puis magic link
  `POST /auth/v1/otp` → 200 (un échec SMTP répondrait 500), e-mails reçus —
  d'abord **en spam Gmail** faute de DMARC. **DMARC posé (2026-07-19)** via
  l'API Netlify DNS : `TXT _dmarc.iiivan.org` =
  `v=DMARC1; p=none; rua=mailto:ivan.duchauffour@gmail.com` (DKIM et
  Return-Path `send.` étaient déjà OK). Durcir en `p=quarantine` plus tard ;
  la réputation Gmail peut demander quelques envois + « Non spam ». NB : le
  wrapper `netlify api createDnsRecord` renvoie 422 (payload mangé) — passer
  par l'API brute `POST /dns_zones/{id}/dns_records`.
- [x] **Template email « Magic Link » avec le code OTP (D6)** — **FAIT ET
  VÉRIFIÉ (2026-07-28)** : l'auth du shell serveur/navigateur passe par un
  **code à 6 chiffres** tapé dans l'app (`verifyOtp`), pas par la redirection
  (fragile sur localhost — serveur-encore-vivant, même navigateur,
  `localhost`→`::1`). Template posé via l'API Management
  (`PATCH …/config/auth`, `mailer_templates_magic_link_content` +
  `mailer_subjects_magic_link`), français branché loupe : code `{{ .Token }}`
  en avant + dans le **sujet** (visible dans l'aperçu boîte mail), lien
  `{{ .ConfirmationURL }}` gardé en repli Tauri. **Parcours OTP confirmé OK
  par l'utilisateur** (code reçu, connexion en place, PR #285). Gotcha :
  l'API Management est derrière Cloudflare qui **bloque le User-Agent
  `Python-urllib` (403 code 1010)** — passer par `curl`.
- [ ] **Redirect allowlist `http://127.0.0.1:6173`** (D6, optionnel) : le
  binaire ouvre désormais `127.0.0.1` (bind IPv4-only). Pour le **repli**
  magic-link sur le shell serveur, ajouter `http://127.0.0.1:6173` à
  l'allowlist de redirection (Auth → URL Configuration). **Pas nécessaire
  pour l'OTP** (aucune redirection).

## Vérifications desktop (clos — le shell Tauri est retiré, plus rien à rejouer)

- [x] **PKCE bout-en-bout en bundle Tauri — FAIT ET VÉRIFIÉ (2026-07-24)** :
  bundle debug installé, magic link réel, session au menu compte. Recette :
  `pnpm --filter @app/desktop tauri build --debug --bundles app` (le build
  web s'enchaîne via `beforeBuildCommand` ; la CLI Tauri vit dans
  `@app/desktop`, un `pnpm exec tauri` à la racine échoue) → installer le
  `.app` dans `/Applications` → demander le lien **depuis l'app installée**.
  **Deux bugs corrigés pour y arriver** (PR #248) : l'URL de LANCEMENT
  n'était jamais lue (`onOpenUrl` ne rejoue pas le lien qui démarre l'app —
  il faut `getCurrent()`), et l'échec d'échange PKCE était avalé (`void`) —
  il logge désormais en console. Rappels macOS : deep links **seulement**
  avec le bundle installé dans `/Applications` (jamais `tauri dev`), et le
  magic link doit être demandé depuis cette app (le code_verifier vit dans
  son webview). NB : le lien admin `generate_link` (dev) reste en fragment
  implicite et ne logge plus — c'est voulu.
- [x] **Exports desktop** — **FAIT ET VÉRIFIÉ EN BUNDLE RELEASE
  (2026-07-19)** : flux natif deux temps (dialogue immédiat via
  `pick_export_path`, écriture Rust via `write_export` sous jeton), toast
  seulement à la livraison réelle, Annuler = silence. L'impression reste
  désactivée avec hint (chantier dédié). NB : l'IPC du webview bundlé
  plafonne à ~8 MB/s — zip stems ~230 MB ≈ ~29 s narrés par la busy line.

## Fait (traçé)

- [x] Origins Tauri : ajoutées aux trois allowlists (T2.5), puis **retirées
  des défauts** avec le shell (#327) ; parité des trois copies verrouillée
  par `docs/origins-parity.spec.ts` (#328) — le redeploy ci-dessus applique
  le nouveau défaut.
- [x] Quota unique séparation/détections (décision M1.2), gate JWT partout,
  brute-force codes throttlé (U.3), secrets planchers 32+ (U.3/U.5).
- [x] Sécurité shell desktop (AC, PR #210) : yt-dlp pinné sha256, fs deny
  sur `bin/`, CSP réelle, PKCE.
- [x] L'import ne dépense plus le quota (AG.1, roadmap v6) — la première
  analyse est un geste explicite de l'utilisateur.
- [x] Copy quota épuisé actionnable (reset le 1ᵉʳ du mois).
- [x] Alerte CVE pip (AA.1, dependabot), CI Rust (AI.1).
