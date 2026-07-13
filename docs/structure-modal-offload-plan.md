# Plan — serveur GPU → Modal (thin client Tauri)

> Brouillon à affiner. **Décision (archi A)** : déporter **tout le calcul ML**
> (tempo, accords, structure, séparation) sur du serverless GPU (Modal) et faire
> de l'app Tauri un **thin client** — aucun Python/torch chez l'utilisateur. On
> réutilise le contrat de job et le seam d'adapter **déjà en place**.

## 1. Décision & périmètre

- **Archi retenue : thin client, tout Modal.** Le vrai fardeau d'un produit
  grand public en Tauri n'est pas le coût GPU (borné par quota + plafond) mais
  **shipper/maintenir un sidecar Python torch+CUDA** sur du hardware au hasard.
  Tout-Modal le supprime : installeur léger, marche partout, une seule infra.
- **Périmètre : les 4 endpoints ML → Modal.**
  - Structure (SongFormer) — lourd GPU, pas d'ONNX. Le bottleneck confirmé.
  - Séparation (Demucs) — lourd GPU. Sur Modal malgré le chemin ONNX local :
    cohérence + suppression du sidecar l'emportent (transfert des stems assumé).
  - Tempo (beat_this) / accords (BTC) — torch CPU (légers) mais **pas de sidecar
    local** dans l'archi A → ils passent aussi par Modal.
- **Reste local (Web Audio, aucun changement)** : playback, loop, pitch/tempo
  (rubberband), timeline. **La pratique marche hors-ligne ; seule l'analyse ML
  est online.**
- **Cible packaging** : Tauri (webview système). Thin client → pas de sidecar.

## 2. Ce qui NE change pas (le seam est déjà construit)

- **Cœur agnostique** : le port `StructureDetector` ne sait pas où tourne le
  DSP. Zéro changement core.
- **Contrat de job déjà pur & stateless** : `POST /structure` (WAV →
  `{segments:[{start,end,label}]}`, secondes brutes). Le snapping downbeats +
  la traduction Lingui restent côté client (S.2/S.3). Inchangé.
- **Adapter déjà paramétré par URL** : `createHttpStructureDetector(baseUrl)`,
  `VITE_SEPARATOR_URL` (défaut `http://localhost:8000`). AbortSignal, timeouts,
  erreurs typées (M.1/M.2/O.5) déjà là.

→ Pointer la structure vers Modal est **un détail de config**, pas une
réécriture.

## 3. L'entrypoint Modal réutilise le serveur FastAPI

Le worker Modal **est** le serveur FastAPI actuel : les routers `structure` /
`separation` / `tempo` / `chords` + les modules vendored (SongFormer, BTC) +
`weights_cache` + `limits` tournent tels quels. Un entrypoint Modal monte l'app
(le pattern lazy-router de `main.py` le permet), poids bakés, GPU.

Config visée :
- `gpu="L4"` (24 Go — couvre les backbones SSL + Demucs avec marge, le moins
  cher).
- **Poids bakés dans l'image** (ou un Volume), sha256-pinnés comme aujourd'hui.
- `enable_memory_snapshot=True` + chargement dans `@modal.enter(snap=True)`.
- `scaledown_window ≈ 120 s` (réutilise le conteneur chaud sur une salve).
- `min_containers=0` → **coût nul quand l'app dort**.
- **Le chunking reste** (borne le pic vRAM, structure ET séparation).

Bénéfice : **un seul code serveur**, local (CPU) en dev, Modal (GPU) en prod.
Rapatriement futur d'une tâche = un aiguillage, sans toucher l'app.

Côté app, changement minimal :
- Les `create*Detector` pointent vers l'URL Modal (`VITE_ANALYZE_URL`, fallback
  `VITE_SEPARATOR_URL`) au lieu de `localhost:8000`.
- `postWavForJson` (+ `http-separator`) injectent le token minté (cf. §7).

## 3bis. Upload-once (dès qu'on passe multi-tâches en distant)

Aujourd'hui chaque détecteur **upload le mix indépendamment**. Anodin sur
localhost ; sur Modal, tempo+accords+structure = **uploader 50 Mo trois fois**.
Deux stratégies :
- **Upload-once** : le mix va une fois dans un Volume/URL signée (clé = hash de
  contenu, dédup) ; chaque tâche référence la clé. Élégant, mais ajoute du state
  + une GC côté Modal.
- **Per-task upload** (statu quo) : plus simple, tolérable à l'échelle beta.

Reco : **démarrer per-task**, mesurer, passer upload-once si le ré-upload gêne.
La séparation garde son endpoint propre (sortie lourde, cycle de vie distinct).

## 4. Décisions à trancher

| Décision | Reco de départ | À creuser |
|---|---|---|
| **Auth de l'endpoint** | **Supabase** : comptes (magic link) + quota (Postgres/RLS) + Edge Function qui émet un token court-lived → app appelle Modal en direct, Modal vérifie le token. Plafond de dépense Modal dur en plus. | cf. §7. Le secret Modal reste dans l'Edge Function, jamais dans le binaire Tauri. Gating beta = invitation / table `beta_codes`. |
| **Sync vs async** | **Synchrone** d'abord (timeout généreux, AbortSignal déjà géré). Job+polling seulement si le cold start le force. | Mesurer le pire cas cold-start + inférence vs la fenêtre HTTP. |
| **Transfert audio** | Upload direct du WAV (comme aujourd'hui). URL signée si la taille gêne. | Vie privée : la musique quitte la machine (cf. §7). |
| **Tempo auto-import** | Le tempo tourne AUTO à chaque import → en archi A, chaque import = un aller-retour Modal (+ cold start possible) avant de voir la grille. | La plus grosse conséquence UX. Options : cold start rapide (§5) ; ou rendre l'analyse explicite/dégroupée ; ou plus tard un beat-tracker WASM local pour la grille immédiate. À trancher. |

## 5. Cold start — MESURÉ (spike v1, 2026-07-13)

**Spike v1 fait** (poids bakés, L4, naïf — sans snapshot ; voir
[server/MODAL_SPIKE.md](../server/MODAL_SPIKE.md)) :

```
COLD  wall= 61.7s   (boot ~6s + load 31.6s + first-infer 23.8s)
WARM  wall=  0.9s   (infer 0.5s)
```

- **À chaud : 0,5 s** — excellent. Avec `scaledown_window=120s`, une session ne
  paie le froid qu'une fois.
- **À froid ~62 s** : `load 31.6s` (imports SSL + ~2 Go poids → GPU, cible des
  snapshots) + `first-infer 23.8s` (autotune CUDA au 1ᵉ forward, PAS de
  l'inférence — un warmup dans `@modal.enter()` l'absorbe).

**Spike v2 fait (2026-07-13)** — ce qui marche et ce qui ne marche pas :
- ✅ **Warmup dans `enter()`** (un forward bidon) : absorbe l'autotune → l'infer
  réel passe **23,8 s → 0,5 s** (froid ET chaud).
- ❌ **Memory Snapshots (CPU)** : **rejetés**. L'état à restaurer = plusieurs Go
  de poids en RAM ; le restore (~34 s) est aussi lent que recharger. Les
  snapshots gagnent quand les imports/JIT dominent, pas des Go de poids. Cold
  restauré mesuré = **54,7 s**, aucun gain.
- **Plancher du froid ≈ 50 s** (load + move GPU + autotune), incompressible sans
  **GPU memory snapshots (alpha)** — le seul levier qui capturerait l'état GPU
  chaud — ou un conteneur toujours chaud (`min_containers=1` ≈ $575/mois, non).

**Conséquences produit :**
- **Tempo auto-à-l'import ≠ Modal** (~50 s avant la grille = non) → tempo instant
  local/WASM, ou analyse explicite.
- **Sync reste viable** (~50 s tient dans un timeout HTTP).
- **Mitigation retenue = warm-on-import prefetch** : au chargement d'un morceau,
  tirer un ping de warmup en tâche de fond vers Modal → le conteneur est chaud
  quand l'user clique une analyse à la demande. **Cacher le froid derrière le
  temps de réflexion** plutôt que le combattre. (GPU snapshots alpha en réserve
  si insuffisant.)

## 6. Coût (rappel, à re-mesurer)

~1 cent/morceau à chaud, 1-4 cents à froid (L4/A10G). Crédit gratuit Modal
$30/mois → coût réel probablement nul au lancement **à faible volume et sans
abus** (cf. §7). `min_containers=0` = pas de réservation GPU.

## 7. Risques & garde-fous

- **Auth d'une app distribuée (LE risque)** : un token statique embarqué dans
  le binaire Tauri est extractible → n'importe qui peut griller votre GPU. App
  attestation ~inexistante sur desktop → sans compte, on ne distingue pas un
  vrai user d'un bot. **Direction retenue : Supabase.**
  - **Comptes** : Supabase Auth (magic link). Gating beta = invitation / table
    `beta_codes` redeemé à l'inscription.
  - **Broker** : une Edge Function `mint-structure-token` vérifie le JWT user,
    lit/décrémente le **quota** (Postgres + RLS), émet un **token court-lived**
    (JWT HS256, secret partagé avec Modal).
  - **Appel** : l'app envoie le WAV **directement à Modal** avec ce token (pas
    via Supabase — limites Edge Functions sur 50 Mo). Modal vérifie le token.
  - **Secret Modal** : dans les secrets de l'Edge Function, **jamais** dans le
    binaire.
  - **Défense en profondeur** : quota par-compte (Supabase) **+** plafond de
    dépense Modal dur (503 au-delà du budget/jour).
- **Vie privée (accrue en archi A)** : ~tout l'audio part au cloud (chaque
  import déclenche le tempo). Note de confidentialité plus visible ; choix
  conscient.
- **Hors-ligne** : l'analyse ML ne marche plus hors-ligne — mais playback,
  loop, pitch/tempo (rubberband) restent 100 % locaux, donc la pratique tient.
- **Lock-in** : le worker est une image conteneur → self-hostable sur GPU loué
  demain sans réécrire l'app (juste le routeur). Porte de sortie.
- **Divergence local/Modal** : un seul code serveur évite le drift.

## 8. Découpage en tranches

1. **Spike cold-start** : entrypoint Modal minimal qui monte le serveur FastAPI
   (structure d'abord) + poids bakés + un smoke test, gaté par un token jetable
   en dev. Mesurer le boot chaud et froid. *(lève le seul vrai inconnu ;
   « beta » ne veut PAS dire auth d'abord)*
2. **Supabase** : projet + Auth magic link + table `usage`/quota (RLS) + Edge
   Function `mint-analyze-token` ; Modal vérifie le token émis.
3. **Routage adapter** : `VITE_ANALYZE_URL` + le token minté injecté dans
   `postWavForJson` + `http-separator` (via les `create*Detector`).
4. **Étendre aux 4 tâches** : structure → séparation → accords → tempo, une par
   une, chacune vérifiée. Décider upload-once vs per-task en cours de route.
5. **Bascule env** : dev = local (sans auth), prod = Modal + Supabase, documenté.

## Questions ouvertes (pour la discussion)

- Quota par-compte au lancement (n morceaux/mois/user) → dimensionne coût +
  anti-abus. À poser en même temps que le plafond global Modal.
- Gating beta : invitation-only Supabase, ou table `beta_codes` redeemée ?
- Vie privée : note utilisateur « audio envoyé temporairement, non conservé ».
- Vérif token Modal↔Supabase : JWT HS256 (secret partagé) — le plus simple ;
  à confirmer au spike auth.
