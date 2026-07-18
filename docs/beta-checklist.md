# Checklist beta — garde-fous et vérifications

> État au **2026-07-18**, après la roadmap v6 (Lots AC→AI). Deux garde-fous
> demandent une action **utilisateur** (comptes/facturation) ; le reste est
> soit fait, soit une vérification à rejouer en bundle.

## À faire par l'utilisateur (non automatisable)

- [ ] **Plafond de dépense Modal** — le garde-fou beta acté en M1.2/M1.3
  (`max_containers=1` limite le débit, pas la facture). Le CLI ne sait que
  lire (`modal billing report`) : le **spend cap / billing alert se pose dans
  le dashboard Modal** (Settings → Billing). Référence : dépense du mois en
  cours mesurée ce jour ≈ **3,67 $** (tout le développement inclus) — un
  plafond à ~25 $/mois laisse un ordre de grandeur de marge à la beta.
- [ ] **SMTP custom Supabase** — sans lui, ~2 e-mails/h sur tout le projet :
  deux magic links et la beta est sourde (noté depuis T2.1bis). Choisir un
  fournisseur (Resend/Brevo/SES…), créer la clé, puis Dashboard Supabase →
  Auth → SMTP (ou `config.toml` + management API). Penser au domaine
  d'envoi (SPF/DKIM).
- [ ] **Re-seed des codes beta legacy < 32 chars** en prod (runbook U.3 :
  `gen_random_uuid()`, le CHECK d'entropie ne couvre que les nouveaux).

## Vérifications à rejouer (bundle desktop)

- [ ] **PKCE bout-en-bout en bundle Tauri** (AC.3 a changé le flux : le
  callback porte `?code=`, plus jamais de tokens) — recette T2.1bis :
  `pnpm --filter @app/web build` → `pnpm exec tauri build --debug --bundles
  app` → magic link réel → session visible au menu compte. NB : le lien
  admin `generate_link` (dev) reste en fragment implicite et ne logge plus —
  c'est voulu, tester avec un vrai magic link.
- [ ] **Exports desktop** : AH.1 v1 = boutons désactivés avec hint sous
  Tauri (jamais un toast sur un export fantôme). Le chemin natif
  (plugin-dialog save + fs) est le follow-up — à vérifier en bundle quand il
  sera fait.

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
