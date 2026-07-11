# Session — 2026-07-11 — origin-guard (M.1)

## Done
- **M.1 — garde Origin (CSRF « simple request »)** (roadmap-excellence-3) :
  `OriginGuardMiddleware` à côté de `LoopbackOnlyMiddleware`
  ([netguard.py](../../server/app/netguard.py)) — **403** pour toute requête
  portant un en-tête `Origin` hors `LOUPE_ALLOWED_ORIGINS`. CORS empêche de
  *lire*, pas d'*envoyer* : un POST « simple request » (`text/plain`, sans
  préflight) pouvait déclencher `/download`, `/audio`, les inférences ou `/gc`
  depuis une page tierce. Sans `Origin` (curl, clients natifs) → passe (pas
  de CSRF médié par navigateur).
- **/code-review (4 agents, angles fusionnés) → 4 constats corrigés** :
  - chaque valeur `Origin` est vérifiée (un parse dict gardait la *dernière*
    des dupliquées — une Origin étrangère pouvait passer clandestinement) ;
  - les requêtes **same-origin** (`Origin == scheme://host` du serveur,
    ex. les POST « Try it out » de `/docs`) sont acceptées — l'Origin d'un
    navigateur n'est pas forgeable et TrustedHost vérifie déjà le Host ;
  - allowlist calculée **une fois**, partagée CORS + garde ;
  - les tests CORS origine-étrangère assertent désormais le 403 de la garde
    (ils passaient vacuement après le court-circuit).
- Docs à jour : trust model dans le docstring de `main.py` + section sécurité
  du [README serveur](../../server/README.md) ; commentaire de l'oignon
  middleware corrigé (CORS < OriginGuard < TrustedHost < LoopbackOnly).

## Not done / remaining
- Dédup du helper `_drive` entre `test_netguard.py` et `test_origin_guard.py`
  — écarté : les deux divergent (scope `server` vs `headers`+`scheme`) et
  jscpd ne couvre pas `server/` ; un conftest partagé n'apporterait presque
  rien.
- L'option alternative « en-tête `X-Loupe-Client` » (préflight forcé) écartée :
  la garde Origin ne demande **aucun** changement côté adapters web.

## Decisions
- **Same-origin est de confiance** : une page servie par notre propre serveur
  peut poster ; le vecteur CSRF est une page *tierce*, dont l'Origin (non
  forgeable) ne peut pas égaler la nôtre.
- Comportement pour `Origin: null` / vide : **refusé** (iframe sandboxée,
  file:// = étranger).

## Gate status
- typecheck: n/a côté serveur — **pyright ✅** (0 erreur)
- tests (with coverage): **149 pytest ✅** (+13), couverture serveur 97,29 %
  (plancher 80 %)
- mutation (Stryker, local, if core touched): **skippée — lot 100 % serveur
  Python**, aucun fichier `@app/core` touché
- biome / sheriff / knip / jscpd: n/a (aucun fichier TS touché) ;
  **ruff check + format ✅**

## State to resume from
- **Single next action**: merger la PR M.1, puis **M.2** (durcir `/download` :
  sémaphore, `max_filesize`, timeout sur `events.get()`).
- Gotchas / half-done edits: aucun.
