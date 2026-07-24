# Session — 2026-07-16 — M1.2 : modèle quota/coût de la séparation

## Done
- **Mesure réelle** du coût d'une séparation htdemucs_6s sur Modal L4
  (`server/modal_separation_spike.py`, même moule que
  `modal_structure_spike.py` : poids bakés dans l'image, warm dans
  `@modal.enter`, mix synthétique généré DANS le conteneur pour sortir
  l'upload de la mesure — le transport est un arbitrage M1.3).
- Résultats (piste 210 s, run Modal
  `ap-yhYU4ldPZ6kd4avteqqFV4`) :
  - **à chaud : 4,7 s** de mur (0,021 s GPU / s d'audio, ~47× temps réel) ;
  - à froid : 16,2 s (load 0,9 s + warmup 1,6 s + infer 4,8 s) — très loin
    des timeouts (900 s Modal, 1800 s local) ;
  - **VRAM pic : 0,57 GB** — le L4 (24 GB) tient très largement, pas
    d'A10G, et la séparation peut monter dans le MÊME conteneur que les
    trois détections M1.1 ;
  - au tarif L4 ($0.000222/s) : **~$0.001 par séparation à chaud**, ~$0.004
    à froid ; le poste dominant est la fenêtre scaledown (300 s ≈ $0.067),
    déjà payée par le conteneur M1.1 en cas de conteneur partagé.
- La prémisse du plan (« une séparation vaut plusieurs ordres de grandeur de
  plus qu'une analyse ») est **réfutée par la mesure** : ~10× une analyse,
  sub-cent dans tous les cas. 20 séparations/mois ≈ $0.02–0.08 marginal.
- [docs/client-leger-plan.md](../client-leger-plan.md) mis à jour : mesure +
  décision consignées en § M1.2, note de gate ajoutée en § M1.3, case M1.2
  cochée dans le Suivi.

## Not done / remaining
- M1.3 (séparation sur Modal) : rien de commencé — c'était voulu, M1.2 est
  une décision produit avant le code.
- Le plafond de dépense / alerte de facturation Modal (garde-fou acté) se
  configure dans le dashboard Modal, pas dans le repo — à poser au moment de
  M1.3 (avant d'exposer la séparation aux beta-testeurs).

## Decisions
- **Quota unique inchangé** (validé utilisateur 2026-07-16) : la séparation
  passe sous le même gate JWT/mint que les trois détections (20 mints/mois,
  un token couvre ~5 min d'opérations). Aucun schéma Supabase touché.
  Garde-fou beta = plafond de dépense Modal ($30 de crédits Starter +
  alerte). Unités pondérées et quota séparé `separations_left` rejetés : de
  la complexité (migration + tests SQL) contre un coût mesuré sub-cent.
- Pas d'A10G : le L4 tient htdemucs_6s avec 0,57 GB de VRAM de pic.

## Gate status
- typecheck: ✅ (via `pnpm gate`, exit 0)
- tests (with coverage): ✅ 97,26 % statements / 92,3 % branches
- mutation (Stryker, local, if core touched): skipped — aucun changement
  dans `@app/core` (la session ne touche que `server/` et `docs/`)
- biome / sheriff / knip / jscpd: ✅ (gate exit 0)

## State to resume from
- **Single next action** : ouvrir **M1.3** — monter le router `separation`
  dans `modal_app.py` (image + poids htdemucs_6s bakés, même conteneur L4
  que les détections), reproduire le contrat streaming NDJSON de
  `http-separator.ts` avec AbortSignal bout-en-bout, et MESURER le transport
  réel (~42 MB up plein débit + ~250 MB down, 6 stems WAV).
- Gotchas :
  - le timeout Modal de l'app est à 900 s vs budget local 1800 s pour
    `/separate` — à aligner en M1.3 (item du plan) ;
  - `server/modal_separation_spike.py` réutilise la chaîne d'image de
    `modal_app.py` (mêmes apt + requirements + env) pour que la couche torch
    soit un cache hit — garder ce parallélisme si les requirements bougent ;
  - la mesure est à mix synthétique : le temps mur demucs dépend de la
    durée, pas du contenu — pas besoin de re-mesurer avec une vraie piste.
