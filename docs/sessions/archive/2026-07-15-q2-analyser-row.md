# Session — 2026-07-15 — Q.2 : rangée « Analyser » unifiée + DetectionAction

## Done
- **Q.2** (branche `feat/q2-analyser-row`, **stackée sur Q.1** — PR à ouvrir
  sur la base de #137) : les 4 actions d'analyse, éclatées en 4 endroits avec
  4 patterns d'état, regroupées en tête de la zone Analyse.
  - **`DetectionAction`** (`app/ui/`) : la grammaire partagée — bouton, confirm
    deux-temps avant écrasement, hint bloquant, ligne d'échec en
    `role="alert"` (le contrat shell-wide), LiveStatus monté en permanence.
  - **`AnalyserRow`** (`app/analyser/`) : Séparer · Tempo · Structure ·
    Accords, chaque item portant son état ; empreinte stable (séparation et
    tempo terminés = face « ✓ » au lieu de disparaître). La copy actionnable
    des 4 flux regroupée dans `analyser/detection-copy.ts` (ids inchangés).
  - **Panneaux allégés** : `SeparationPanel` supprimé ; `MarkerControls` ne
    garde que + Repère / + Section ; `ChordChartPanel` perd sa detectRow (garde
    ± ½ / Imprimer / Modifier / divergence pitch) ; `TempoPanel` ne garde que
    les corrections (BPM, temps, ÷2/×2, Tap, Caler) + l'annonce a11y.
  - `useChordDetection.detect()` : `barsPerRow` optionnel, repli sur la
    préférence localStorage dans le hook (le shell ne connaît plus le
    stockage).
  - Specs : acceptance `workstation-shell.analyser.spec.tsx` (rouge → vert),
    tests de détection migrés vers `analyser-row.spec.tsx` (31 tests) ;
    marker-controls / chord-chart-panel / tempo-panel specs recentrés.
  - Browser-verify (5173) : rangée conforme, détection d'accords lancée depuis
    la rangée → grille remplie + annonce (bout-en-bout).
  - Revue 3 finders (8 angles) : 3 fixés (double read-out tempo, runningLabel
    mort, lecture localStorage remontée dans le hook), 2 différés (item tempo
    manuel → Q.3 ; face busy séparation hors grammaire → R.1), 1 documenté
    (LiveStatus monté à vide), 2 réfutés (limites de lignes — gate verte ;
    exports de types — le spec les importe).

## Not done / remaining
- Q.3 (zone Analyse repliable + résumé de l'acquis + read-out header), Q.4,
  Q.5 — voir le Suivi roadmap v4.
- Le hint pédagogique `separation.idle-hint` (« Les pistes séparées
  s'alignent… ») ne survit pas au format compact de la rangée — assumé
  (l'empty-state et la doc du produit couvrent la découverte).
- Un tempo posé à la main sans détection n'a pas d'item dans la rangée —
  assumé (badge « Manuel » du TempoPanel ; l'en-tête replié Q.3 résumera).

## Decisions
- **Checkpoint validé (utilisateur)** : item Tempo = read-out d'état +
  Réessayer (les corrections restent au panneau) ; branche stackée sur Q.1.
- **Révisions explicites** de N.4 (« Détecter les accords » en tête de son
  panneau) et du placement « séparation près de l'import » — remplacés par la
  rangée unique de la zone Analyse (prévu par la roadmap v4).
- Les échecs de détection interrompent (`role="alert"`) ; le canal poli ne
  porte que busy/done — c'était le contrat des specs shell (tempo, stems).
- Ids Lingui nouveaux : `analyser.tempo-detecting`, `analyser.tempo-done` ;
  ids supprimés du catalogue : `separation.region-label`,
  `separation.section-label`, `separation.idle-hint`, `tempo.retry`… (extract
  fait foi).

## Gate status
- typecheck : ✅
- tests (with coverage) : ✅ **1441 tests** (–7 vs Q.1 : tests de détection
  dédupliqués à la migration), coverage ~96,7 % lignes
- mutation (Stryker) : **skippé — core intouché** (packages/web seul)
- biome / sheriff / knip / jscpd (0,34 %) / check:tokens / react-doctor : ✅

## State to resume from
- **Single next action** : ouvrir la PR de `feat/q2-analyser-row` (base
  `feat/q1-shell-zoning` tant que #137 n'est pas mergée, puis rebase sur
  `main`) ; ensuite **Q.3** (slice UI → checkpoint d'approche : zone Analyse
  repliable motif P.3 + localStorage, en-tête replié « 104 BPM · 4/4 ·
  12 sections · grille 96 mes. », et câbler ou supprimer le read-out
  `detected` du header — shell-header.tsx:14).
- Gotchas : `detect()` du hook accords lit la préférence stockée quand il est
  appelé sans argument (la valeur live du champ ne vaut que via le panneau,
  qui ne détecte plus) ; `DetectionAction` garde son LiveStatus monté même
  sans annonce (perte de première annonce sinon) ; la face busy de la
  séparation est volontairement hors grammaire en attendant R.1.
