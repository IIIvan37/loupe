# Plan d'implémentation — offload structure sur Modal

> Exécution de la décision cadrée dans
> [structure-modal-offload-plan.md](structure-modal-offload-plan.md) (archi A :
> thin client, tout Modal) après le spike (#123/#124 : chaud 0,5 s, froid ~50 s
> caché par warm-on-import). Ce doc découpe le BUILD en tranches livrables.

## Principes

- **Cœur intouché** : les ports (`StructureDetector`…) existent ; le build est de
  l'**adapter (web)** + de l'**infra (Modal/Supabase)**. TDD si un jour le core
  bouge (non prévu) ; les slices web suivent `react-testing-patterns` ; la gate
  reste verte.
- **Partage par nature de la donnée, PAS « tout Modal »** (cf.
  [plan §1](structure-modal-offload-plan.md#1-décision--périmètre)) : seule
  l'**inférence GPU** part sur Modal. **Restent LOCAUX** : le stockage
  **projets + audio** (`ProjectStore`/`ProjectAudioStore`, `/projects` + `/audio`)
  et le **download yt-dlp** (`TrackSource`, `/download`) — droit d'auteur : la
  musique de l'user ne quitte pas sa machine, et yt-dlp tourne sur son IP. Donc
  **le serveur Python local ne disparaît pas, il rétrécit** (garde storage +
  download, perd l'inférence) ; Tauri le remplacera par du Rust (fs + sidecar
  yt-dlp), zéro Python.
- **Sur l'app web actuelle** — Tauri est du packaging orthogonal, plus tard.
- **Décisions déjà prises** : tempo = *accepter le cold à l'import* (pas de tracker
  WASM) ; jalon 1 = *MVP token statique* avant Supabase.

---

## Jalon 1 — MVP token statique (valider l'offload de bout en bout)

But : la détection de structure tourne sur un endpoint Modal **déployé**, appelée
depuis la vraie app, gatée par un token statique, avec warm-on-import. Pas de
Supabase. But = lever le risque d'intégration au moins cher.

### 1.1 — Endpoint Modal HTTP (prod)

- Promouvoir le spike en endpoint **HTTP** : `@modal.asgi_app()` montant une
  FastAPI minimale avec **seulement** le router `/structure` (+ le warmup de
  l'`enter()`, poids bakés, `scaledown_window≈300s`).
- **Auth** : vérifier `Authorization: Bearer <LOUPE_MODAL_TOKEN>` (secret Modal) ;
  401 sinon.
- **`/warmup`** : route no-op qui répond vite après l'`enter()` (chauffe le
  conteneur pour le prefetch).
- **CORS** : autoriser l'origine de l'app (dev `localhost:5173`).
- **Plafond de dépense** Modal dur (config compte + note dans le runbook).
- *Accept.* : `curl` `/structure` avec token → 200 `{segments}` ; sans → 401 ;
  `/warmup` → 200 rapide à chaud.

### 1.2 — Routage adapter + token (web)

- `create-structure-detector.ts` lit `VITE_STRUCTURE_URL` (fallback
  `VITE_SEPARATOR_URL`).
- `postWavForJson` injecte `Authorization: Bearer` depuis un token lu **au
  runtime** (`localStorage`, `analysisToken()`) — **jamais un `VITE_*` embarqué**
  (un secret inliné dans le bundle est extractible ET refusé par le security
  gate). Un dev le seed via `localStorage.setItem('loupe.modal.token', …)` ;
  **remplacé par le token minté Supabase au J2** (déjà runtime → swap minime).
- *Accept.* : envs posées → la structure tape Modal ; specs existantes vertes
  (l'adapter est injecté en test, donc rien à réécrire).

### 1.3 — Warm-on-import prefetch (web)

- Au chargement d'un morceau (`loadedAudio` posé), tirer un `POST /warmup`
  fire-and-forget (annulé à l'unmount / au remplacement de piste). Un hook
  `useModalWarmup` ou un effet dédié.
- *Accept.* : importer une piste déclenche 1 warmup ; une détection structure
  juste après tombe sur du chaud (~0,5 s).

### 1.4 — UX du cold (structure + tempo)

- Les hooks de détection ont déjà busy + `LiveStatus` + AbortSignal. Vérifier que
  le ~50 s cold est supportable : garder l'état busy, ajouter un mot « première
  analyse plus longue ». Le tempo auto-import **assume le cold** (barre de
  progression, pas de blocage dur).
- *Accept.* : 1er import d'une session → « détection… » visible ~50 s puis grille ;
  imports suivants chauds.

**Fin J1** : l'offload structure marche dans l'app, token statique. Risque
d'intégration levé.

---

## Jalon 2 — Supabase (remplace le token statique)

### 2.1 — Projet Supabase
- Auth **magic link** ; table `usage` (quota/user) + **RLS** ; gating beta
  (invitation-only ou table `beta_codes`).

### 2.2 — Edge Function `mint-analyze-token`
- Vérifie le JWT user → lit/décrémente le quota (Postgres/RLS) → émet un **token
  court-lived** (JWT HS256, secret partagé avec Modal).

### 2.3 — Modal vérifie le token minté
- Remplacer le check token-statique par une **vérif JWT** (secret partagé). Le
  secret Modal reste côté serveur.

### 2.4 — Web : auth + token minté
- UI sign-in magic link ; acquisition + cache du token ; injecter le token minté
  au lieu du statique (retire `VITE_MODAL_TOKEN`).
- *Accept.* : seuls les users connectés dans leur quota lancent une analyse ;
  aucun secret dans le binaire.

---

## Jalon 3 — Étendre aux 4 tâches

- **Accords** → Modal (même patron que structure).
- **Séparation** → endpoint propre (sortie stems lourde : upload mix + download
  4 stems).
- **Tempo** → Modal (assume le cold à l'import).
- Décider **upload-once vs per-task** sur mesure du ré-upload réel.

---

## Décisions produit à trancher (pour le J2)

- **Quota/user** au lancement (n morceaux/mois).
- **Gating beta** : invitation-only Supabase vs table `beta_codes`.
- **Montant du plafond** Modal global.

## Risques

- **Token statique J1 extractible** — assumé, temporaire, remplacé au J2 ;
  plafond de dépense en garde-fou dès le J1.
- **CORS/origine** — l'`OriginGuard` local ne transpose pas ; configurer le CORS
  de l'endpoint Modal explicitement.
- **Cold ~50 s** — caché par le prefetch ; si insuffisant en usage réel, GPU
  memory snapshots (alpha) en réserve.
