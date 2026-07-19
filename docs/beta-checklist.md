# Checklist beta — garde-fous et vérifications

> État au **2026-07-18**, après la roadmap v6 (Lots AC→AI). Deux garde-fous
> demandent une action **utilisateur** (comptes/facturation) ; le reste est
> soit fait, soit une vérification à rejouer en bundle.

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
- [ ] **Re-seed des codes beta legacy < 32 chars** en prod (runbook U.3 :
  `gen_random_uuid()`, le CHECK d'entropie ne couvre que les nouveaux).

## Vérifications à rejouer (bundle desktop)

- [ ] **PKCE bout-en-bout en bundle Tauri** (AC.3 a changé le flux : le
  callback porte `?code=`, plus jamais de tokens) — recette T2.1bis :
  `pnpm --filter @app/web build` → `pnpm exec tauri build --debug --bundles
  app` → magic link réel → session visible au menu compte. NB : le lien
  admin `generate_link` (dev) reste en fragment implicite et ne logge plus —
  c'est voulu, tester avec un vrai magic link.
- [x] **Exports desktop** — **FAIT ET VÉRIFIÉ EN BUNDLE RELEASE
  (2026-07-19)** : flux natif deux temps (dialogue immédiat via
  `pick_export_path`, écriture Rust via `write_export` sous jeton), toast
  seulement à la livraison réelle, Annuler = silence. L'impression reste
  désactivée avec hint (chantier dédié). NB : l'IPC du webview bundlé
  plafonne à ~8 MB/s — zip stems ~230 MB ≈ ~29 s narrés par la busy line.

## Fait (traçé)

- [x] Origins Tauri (`tauri://localhost` + `http://tauri.localhost`) dans
  les trois allowlists (T2.5, curl-vérifié).
- [x] Quota unique séparation/détections (décision M1.2), gate JWT partout,
  brute-force codes throttlé (U.3), secrets planchers 32+ (U.3/U.5).
- [x] Sécurité shell desktop (AC, PR #210) : yt-dlp pinné sha256, fs deny
  sur `bin/`, CSP réelle, PKCE.
- [x] L'import ne dépense plus le quota (AG.1, roadmap v6) — la première
  analyse est un geste explicite de l'utilisateur.
- [x] Copy quota épuisé actionnable (reset le 1ᵉʳ du mois).
- [x] Alerte CVE pip (AA.1, dependabot), CI Rust (AI.1).
