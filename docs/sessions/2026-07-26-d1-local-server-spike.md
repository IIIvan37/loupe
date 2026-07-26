# Session — 2026-07-26 — d1-local-server-spike

## Done

- **Journée charnière — trois décisions produit successives, instruites en
  conversation** : (1) doute sur la direction desktop → re-confirmation que
  l'import YouTube central impose yt-dlp local (IP résidentielle) ; (2)
  « on ne vise pas que Mac » → bascule sur le canal **serveur local +
  navigateur** (zéro signature ×3 OS, un seul moteur web) ; (3) séquence
  route 1 (spike Python) puis route 2 (binaire Rust) actée →
  [distribution-plan.md](../distribution-plan.md) (D1–D6), Tauri en sommeil,
  roadmap v7 archivée.
- **D1 livré (PR #275, branche `feat/d1-local-server-spike`), verdict GO** :
  - `server/app/main.py` sert la web dist (`LOUPE_WEB_DIST`, mount statique
    après les routes API) — 3 tests fresh-import torch-free.
  - Adaptateurs `http-project-store`/`http-track-source` ressuscités de
    l'historique (AJ.3b, #227), specs d'origine vertes (22).
  - Mode server shell : `VITE_SHELL=server` au build → factories HTTP
    same-origin ; gating d'entrées = `isTauriShell() || isServerShell()`.
  - **Parcours réel complet** (serveur uvicorn sur 5173, dist
    `VITE_SHELL=server`) : import YouTube (yt-dlp serveur) → enregistrer
    (PUT 204, blob déjà dans `/audio` — store partagé download/persistance) →
    rechargement + réouverture (y compris un projet du 18/07 pré-Tauri) →
    magic link PKCE → tempo Modal 73 BPM → séparation Modal 6 pistes →
    enregistrement avec pistes.

## Not done / remaining

- D2 : token de session localhost + port occupé + sémantique de sortie +
  chemin de stockage standard par OS (les gardes Origin/Host/loopback existent
  déjà dans `netguard.py`).
- D3 : packaging `uvx loupe`, port définitif + allowlists, **UX du magic
  link** (voir gotcha PKCE ci-dessous).

## Decisions

- Canal de distribution = serveur local + navigateur (voir plan et
  [ADR éventuel en D3/D4] ; motifs consignés dans le plan).
- Spike sur le port 5173 : zéro reconfiguration d'allowlists (Supabase,
  Modal, Edge) — le port définitif attend D3.

## Gate status

- typecheck: ✅
- tests (with coverage): ✅ (gate JS complète ; +5 specs web dont 2 rouges
  d'abord en TDD)
- mutation (Stryker, local, if core touched): **skippé — aucun fichier
  `@app/core` touché** (adaptateurs web + serveur Python).
- biome / sheriff / knip / jscpd: ✅ · serveur : 235 tests, 98 %, ruff +
  pyright ✅

## State to resume from

- **Single next action**: merger PR #275, puis attaquer **D2** (durcissement
  localhost — token de session en tête, le reste des gardes existe déjà).
- Gotchas :
  - **PKCE et magic link** : le lien s'ouvre dans le navigateur par défaut.
    En usage réel c'est aussi celui qui a demandé le lien → même profil,
    l'échange passe. Le contexte scindé vécu en spike était un **artefact du
    montage de test** (Chrome piloté = instance de debug séparée du Chrome
    par défaut, qui portait une session antérieure) ; résolu en collant l'URL
    du lien dans l'onglet demandeur. Risque résiduel réel limité (navigateur
    non-défaut, clic sur téléphone) — simple note UX pour D3, pas un chantier.
  - « Artiste inconnu » après réouverture : l'uploader n'est pas persisté au
    manifeste projet (identique desktop, antérieur à D1).
  - Build serveur : `VITE_SHELL=server pnpm --filter @app/web build` (la
    config Modal/Supabase vient de `packages/web/.env.local`).
  - Ne jamais faire tourner le serveur 5173 et Vite dev en même temps.
