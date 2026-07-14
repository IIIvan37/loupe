# Session — 2026-07-14 — multi-chords par mesure + erreurs tempo discriminées

## Done

Deux points dans la même PR (branche `feat/multi-chords-per-measure`) :

### 1. Multi-accords par mesure (le point différé du lot pré-démo)

- **`chordLabelPerMeasure`** (core/domain/chord-detection.ts) vote maintenant
  aussi les deux moitiés de chaque mesure, coupées au **beat médian**
  (`beats[round(n/2)]`, repli au milieu temporel si la grille est trop
  clairsemée). Quand chaque moitié est dominée par un accord différent, la
  cellule imprime les deux (`'C G'`) — la mesure à deux accords d'une lead
  sheet. Une moitié dominée par le silence **véto** le split (pas de faux
  changement) ; un label moteur multi-mots (`'A min'`) ne se joint jamais
  (l'espace du join est de la grammaire porteuse en aval).
- **`cellToken`** (chord-chart.ts) accepte une cellule multi-tokens quand elle
  est le join simple-espace de tokens imprimables ; le nouveau
  **`isPrintableToken`** exporté centralise la garde structurelle (`:`, volta
  `1.`, fermata `@`) — partagé avec le relabel.
- **`playedLabels`** (chart-structure.ts) garde TOUS les accords d'une mesure
  au relabel structure (la limitation v1 « 1er accord seulement » est levée) ;
  un token non imprimable est filtré au lieu d'effacer la barre en `N.C.`.
- **`matchesBlock`** compte l'accord de TÊTE comme accord entre occurrences
  (`'F G'` vs `'F'` = accord) : le jitter du split ne casse plus le
  regroupement des sections répétées ; le vote (`votedBlock`) nettoie le
  split minoritaire.
- Modèle (`Measure.chords` tableau), parseur, LeadSheet web : déjà prêts —
  zéro changement serveur ni UI.

### 2. Retrofit `/tempo` sur les erreurs discriminées (le reliquat N.1)

- **`detectTempo`** (core) : `{ok:false, code, detail}` +
  `TempoDetectionError` / `TempoDetectionErrorCode` (`engine-unavailable` /
  `network` / `timeout` / `too-large` / `unknown`) — miroir exact du contrat
  chords N.1. Exports ajoutés à `core/src/index.ts`.
- **`http-tempo-detector`** : les échecs transport passent par
  `classifyTransportError` → `TempoDetectionError` typé.
- **`useTempo`** : `error` devient un code ; le détail brut part en
  `console.error` (jamais l'UI).
- **`TempoPanel`** : map `ERROR_COPY` Lingui (`tempo.error.*`), copy
  actionnable par code ; catalogue fr extrait.
- **`rethrowTransportError`** (post-wav-json.ts) : les trois blocs catch
  identiques des adapters chords/structure/tempo repliés en un helper à côté
  de `classifyTransportError` — une nouvelle classification (401/429 du J2)
  atterrit une fois.

### Revue (8 angles, vérifiée)

3 correctness fixés en TDD (join de label multi-mots, wipe N.C. au relabel,
jitter du split vs match ratio), 1 reuse fixé (`rethrowTransportError`).

## Not done / remaining

- **Écarté (délibéré)** : base d'erreur commune core aux trois
  `XDetectionError` (troisième jumeau) — API publique établie, la décision
  n=2 du rapport S.3a tient encore ; à regrouper si le J2 ajoute des codes
  auth/quota partagés (ce sera le moment : les trois unions bougeraient
  ensemble). ERROR_COPY partagé entre panneaux : ids sémantiques par panneau
  voulus, copy identique acceptée. Micro-optims O(bars×beats) de `cellLabel` :
  sub-ms sur une piste de 4 min, à revoir seulement si des imports d'une heure
  deviennent un usage réel.
- Le split est borné à **2 accords/mesure** (moitiés) — 4 accords/mesure
  (quarts) non demandé, YAGNI.
- Vérif navigateur non faite (core pur + copy panel testés unitairement ;
  la LeadSheet rendait déjà `Measure.chords[]` — cas « browser only » absent).

## Decisions

- **Encodage cellule** : les deux accords voyagent dans le `string` de cellule
  existant (`'C G'`), opaque pour la déduction/vote/print — pas de passage à
  `string[]` par mesure. Contreparties gérées : garde anti-espace à la
  construction (`cellLabel`), accord de tête dans `matchesBlock`.
- **Coupure au beat médian**, pas au milieu temporel (robuste au drift
  intra-mesure ; 2+1 dans une mesure à 3 temps).
- Une moitié silencieuse véto le split ; l'égalité « tie → chord » du vote
  pleine-mesure reste inchangée (règle préexistante délibérée).

## Gate status

- typecheck : vert
- tests (with coverage) : vert — **1444 tests** (+23), coverage 96,7 % st.
- mutation (Stryker, local, core touché) : **93,43 %** (seuil 80) ;
  chord-detection 91,6 / chord-chart 96,6 / chart-structure 88,1
- biome / sheriff / knip / jscpd : verts (8 clones préexistants, inchangés)

## State to resume from

- **Single next action** : ouvrir la PR de `feat/multi-chords-per-measure`
  (3 commits + ce rapport), merger, puis reprendre la file : plus rien
  d'ouvert côté pré-démo — candidats suivants = veille (locale EN, export
  MIDI par stem, boucle A/B clavier) ou consolidation des trois jumeaux
  d'erreurs quand le J2 ajoutera des codes auth.
- Gotchas : un chart détecté AVANT cette PR reste 1 accord/mesure (relancer
  la détection pour bénéficier du split) ; `isPrintableToken` est exporté du
  domaine pour le relabel — ne pas le ré-implémenter côté web.
