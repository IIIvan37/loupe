# Session — 2026-07-16 — V.3 warm des modèles au démarrage local

## Done
- **`server/app/warm.py`** (TDD, 9 tests) : `warm_enabled` (opt-out
  `LOUPE_WARM_MODELS=0`, tout le reste = activé), `warm_models` (chaque loader
  appelé sous `suppress(Exception)` — un modèle froid ne bloque pas les
  autres, lazy + 503 reste le contrat), `start_model_warmup` (thread **démon**
  nommé `model-warmup`, `None` si opt-out ou rien à chauffer ; `environ`
  injectable pour les tests).
- **`warm()` public** sur `tempo` / `chords` / `structure` — une ligne chacun
  au-dessus du getter double-check-locké existant (`_audio2beats` / `_btc` /
  `_load`) : un warm qui course une première requête construit une seule fois.
  `separation` charge déjà eagerly à l'import — rien à faire.
- **`main.py`** : `_warm_loaders` rempli par les blocs capability (seuls les
  modules importés avec succès contribuent), `start_model_warmup(_warm_loaders)`
  au lifespan après le GC de boot. Test de composition ajouté à
  `test_main_fallbacks.py` (ML absent ⇒ le warm-up reçoit `[]`).
- **Smoke réel** (venv local avec torch) : les 3 loaders collectés, warm-up
  complet en **~23 s** sur thread démon (les 3 modèles construits), opt-out
  `LOUPE_WARM_MODELS=0` ⇒ pas de thread.
- Revue diff (low) : rien à signaler — la suite pytest complète reste à 4 s
  (aucun test n'entre dans le lifespan avec la vraie stack ML).

## Not done / remaining
- **V.4 — playhead en `transform`** : prochain item du Lot V (dernier).
- W.3–W.5 restent au lot W.

## Decisions
- Le warm est **best-effort par construction** : erreurs avalées loader par
  loader, thread démon (ne retarde jamais l'arrêt), le chemin lazy + 503
  reste le fallback contractuel. Pas de warm sur Modal (déjà `@modal.enter`).
- Opt-out par env (`LOUPE_WARM_MODELS=0`) plutôt qu'opt-in : la détection de
  tempo part automatiquement à l'import, donc chauffer par défaut est le bon
  défaut pour l'usage réel.

## Gate status
- typecheck: ✅ (gate web complète verte, diff serveur-only)
- tests (with coverage): ✅ web **1536 tests** (inchangé) · serveur
  **231 pytest** (+10), coverage 98,01 %
- mutation (Stryker, local, if core touched): **skippé — core intouché**
  (diff 100 % serveur)
- biome / sheriff / knip / jscpd: ✅ · ruff (lint + format) ✅ · pyright 0

## State to resume from
- **Single next action** : ouvrir la PR de `feat/v3-warm-models`, puis
  attaquer **V.4** (playhead `transform: translateX` compositor-only +
  `will-change`, browser-verify l'alignement aux extrémités et sous zoom).
- Gotchas : le premier boot d'un hôte vierge télécharge ~78 MB de poids
  beat_this (+ BTC + SongFormer) dans le thread de warm — c'est voulu
  (best-effort) ; en cas d'échec réseau la première requête refait le lazy.
