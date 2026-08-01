# Session — 2026-07-31 — garde-fous beta soldés (actions opérateur)

## Done

- **Redeploy Modal** (opérateur) : défaut d'origins sans `tauri://` (#327) +
  arbre `server/` rétréci (#328) en ligne. **Vérifié de l'extérieur** par
  préflight CORS : `Origin: http://localhost:5173` → écho allow-origin ;
  `Origin: tauri://localhost` → 400 sans écho.
- **Redeploy Edge Function** `mint-analyze-token` (opérateur) : même contrôle
  (5173 échoïsé ; `tauri://` → 204 sans écho, le navigateur bloque).
- **Re-seed codes beta legacy** (opérateur, SQL editor) : inventaire = un seul
  legacy (`FRIENDS`, 24 restants) ; opérateur seul utilisateur → purge sans
  redistribution. Un premier `delete` a levé la FK
  `beta_members_code_fkey` (23503, sans cascade) → séquence corrigée : insert
  du code frais → re-point de `beta_members` → delete du legacy, en une
  transaction. Séquence documentée au runbook
  ([j2-supabase-runbook.md](../j2-supabase-runbook.md)).
- [beta-checklist.md](../beta-checklist.md) : **tous les garde-fous soldés**
  (reste l'optionnel D6) ; STATUS aligné. Commits doc-only sur main
  (`abb84fb`, `a8cfe6b`, `079d51e` + celui-ci).

## Not done / remaining

- Item optionnel D6 : allowlist redirect `http://127.0.0.1:6173` (repli
  magic-link seulement — inutile pour l'OTP). Non bloquant, laissé noté.

## Decisions

- Les commandes prod (modal deploy, supabase CLI, SQL prod) restent des
  **gestes opérateur** : le classifieur de permissions les bloque côté agent —
  le flux qui marche est « l'agent prépare les commandes exactes + vérifie de
  l'extérieur (curl), l'opérateur exécute ».

## Gate status

- Lot 100 % docs + actions prod — aucun code touché : gate sans objet (le
  pre-commit l'a rejoué sur les commits docs, vert). Mutation/sonar : sans objet.
- Vérifications réelles : préflights curl Modal + Edge (ci-dessus), SQL de
  re-seed exécuté par l'opérateur avec `returning` lu.

## State to resume from

- **Single next action** : la **1re release taguée** — suivre
  [RELEASING.md](../RELEASING.md) (bump version `crates/loupe-server/Cargo.toml`,
  tag, workflow release, tap Homebrew + `HOMEBREW_TAP_TOKEN`).
- Gotchas :
  - Retirer un code beta déjà utilisé = 3 temps (FK sans cascade) — séquence
    au runbook U.3.
  - Le conteneur Modal part froid (max_containers=1, scaledown 300 s) : un
    premier préflight peut dépasser 20 s — allonger le timeout curl avant de
    conclure à une panne.
