# Session — 2026-07-16 — m11-tempo-chords-modal

Phase 1 du [plan client léger](../client-leger-plan.md), lot **M1.1** : offloader
les détections **tempo** et **accords** vers Modal, sur le chemin structure
éprouvé (J1/J2). Branche `feat/m11-tempo-chords-modal`, PR à ouvrir.

## Done

**Serveur**
- `modal_app.py` monte désormais les routers `/tempo` et `/chords` à côté de
  `/structure`, derrière le même gate JWT court (J2) et la même CORS. Une seule
  app / un seul conteneur : les trois modèles sont bakés dans l'image et chauffés
  dans `@modal.enter` (probe passée par structure **et** tempo **et** chords, si
  bien que chaque première requête d'une session est inférence pure).
- `tempo.py` : checkpoint beat_this `final0` désormais **pinné sha256** (comme
  BTC), résolu par `pinned_weights` avec le 503 `WeightsUnavailable`. Un override
  `LOUPE_TEMPO_CHECKPOINT` (chemin local ou shortname) reste passé verbatim.
  `_bake_weights` télécharge tempo + chords dans l'image ; hash vérifié réellement
  contre le fichier `~/.cache/loupe/beat_this/beat_this-final0.ckpt`.

**Web**
- `create-tempo-detector` / `create-chord-detector` pointent sur `ANALYSIS_URL`
  (Modal si `VITE_STRUCTURE_URL`, sinon serveur local) avec le bearer court
  (`cachedAnalysisToken`, lu par upload) — `http-*-detector` gagnent un
  `tokenProvider` optionnel, comme structure.
- `useTempo` et `useChordDetection` passent le gate `ensureAnalysisToken` avant de
  détecter (offload uniquement) : la détection auto du tempo à l'import minte, un
  échec pose un `gateReason` par flux (hors des codes d'erreur du core).
- `AccountMenuSlot` compare les raisons de gate **par flux** (`gateReasons: []`),
  si bien que deux flux bloqués pour la même raison rouvrent chacun le menu. Les
  notices du gate déménagent dans une map `msg()` module-level (extraction Lingui).
- X.1 étendu aux nouveaux offloads : copy réseau partagée
  `analysis.error.network-offload` + narration cold-start `analysis.cold-start`
  (renommées depuis `structure.*`), face accords dé-gatée de la santé locale en
  mode offload, `tempo.offloaded`/`chords.offloaded` câblés, tempo bloqué au gate
  garde la face idle « Détecter le tempo ».
- Refacto de lisibilité (react-doctor) : le montage de la rangée d'analyse est
  extrait dans `ShellAnalyserRow` (ShellMain repasse sous le budget), défaut
  `NO_GATE_REASONS` stable, helper `gateReasonsOf`.
- Hygiène de test : les deux raccourcis Cmd+S sauvegardaient via le store HTTP réel
  (fetch localhost:8000) — injectent maintenant `fakeProjectStores` comme leurs
  voisins (défaut latent, reproduit sur le parent `2609139`, sans lien avec M1.1).

**Vérification réelle** (Modal v5 déployé — commit 386d3aa) : app sur `:5173`,
serveur local **éteint**, connecté au compte beta (magic link). Réseau observé :
un seul `mint-analyze-token` 200 puis `/tempo` **200** et `/chords` **200** sur
`iiivan37--loupe-structure-api-web.modal.run`. Accords lus « key of Am » (correct
pour le WAV de test Am→F), tempo posé. **Quota 10 → 11** : décrémenté une seule
fois pour les deux analyses (token partagé ~5 min). Accords dé-gatés malgré
« Serveur hors ligne ».

## Not done / remaining

- **Détection de structure en pilotage navigateur** non rejouée : le double-clic
  de confirmation (« Réétiqueter la grille ? ») se fait annuler par un re-render
  sous chrome-devtools. Chemin **inchangé** depuis J1 (déjà offloadé/déployé),
  couvert par ses specs ; non bloquant.
- **PR non encore ouverte** (prochaine action).
- Suite Phase 1 : M1.2 (modèle quota/coût séparation), M1.3 (séparation sur
  Modal), M1.4 (santé par endpoint effectif + UX hors-ligne). Le quota J2
  (20 mints/mois) couvre désormais de fait les trois détections — à re-peser en
  M1.2.

## Decisions

- **Un token, trois détections.** Le quota J2 reste par *mint* (~5 min) ; tempo,
  accords et structure sur la même piste partagent un mint → quota décrémenté une
  fois. Acceptable pour la beta, re-pesé en M1.2 (voir [plan](../client-leger-plan.md)).
- **Checkpoint beat_this pinné sha256** au même titre que BTC (un `.ckpt` est un
  pickle) — le bake Modal et le serveur local partagent la résolution pinnée.
- **`gateReasons` par flux** (tableau), pas une valeur combinée : le menu doit se
  rouvrir quand un second flux bute sur la même raison.

## Gate status

- typecheck : **OK**
- tests (avec couverture) : **OK — 1629 tests** (Stmts 97,26 % / Branch 92,3 %).
  +20 web (détecteurs token, gate tempo/accords, slot per-flow, copy offload row)
  + fix des 2 Cmd+S.
- mutation (Stryker) : **skippé — `@app/core` intouché** (M1.1 est adapters + UI ;
  aucun fichier de `packages/core` modifié).
- pytest serveur : **231 passed** (98 % couverture).
- biome / sheriff / knip / jscpd / react-doctor / design tokens : **Done**.
- ⚠️ CI GitHub toujours en panne de facturation (cf. STATUS) — gate locale = seule
  vérif effective.

## State to resume from

- **Single next action** : `gh pr create` pour `feat/m11-tempo-chords-modal` vers
  `main` (ce rapport + STATUS inclus dans la PR), puis merge.
- Gotchas :
  - `.env.local` porte le vrai `VITE_STRUCTURE_URL` Modal ; les specs qui veulent
    le chemin local **doivent** `vi.stubEnv('VITE_STRUCTURE_URL', '')` (pattern
    déjà en place dans use-tempo/use-chord-detection/use-structure-detection).
  - Modal v5 est **déjà déployé** (les trois analyses en prod). Un `modal deploy`
    ré-exécute le bake (~min) — inutile sauf changement serveur.
  - Vérif navigateur : servir l'app sur **:5173** (allowlist d'origines) et
    fournir un magic link frais (usage unique, expiration rapide).
