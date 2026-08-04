# Session — 2026-08-03 — repères → grille : la structure reste ajustable après sauvegarde

## Done

- **Diagnostic du signalement beta** « après sauvegarde d'un projet avec
  structure et accords, on ne peut plus modifier la structure de la grille » :
  aucun verrou dans les données (pas de statut « validé » persisté) — le vrai
  trou était le sens **repère→grille jamais câblé** (déplacer/renommer/ajouter/
  supprimer un repère de structure ne touchait jamais les headers `[Section]`),
  aggravé par le repli de la zone Analyse au rechargement et l'éditeur replié.
- **Core** — `relabelChartBySections` expose `headLoneRun` (6e paramètre,
  défaut `false` : comportement détection inchangé) : une coupe par sections
  CONNUES garde le header d'une section unique, sinon le sync grille→repères
  effacerait le dernier repère à l'édition de texte suivante.
- **Web / markers** — `relabelChartFromSections` traite les sections comme
  autorité : section unique → header conservé (`headLoneRun=true`) ; **zéro**
  section → headers retirés (rendu « morceau entier » sans header, un header
  orphelin ressusciterait le repère supprimé) ; grille déjà sans header →
  texte rendu verbatim (pas de re-formatage gratuit). `useMarkers` notifie une
  boîte par store (`structureEditSyncAtom`, idiome du run de séparation,
  [ADR 0010](../adr/0010-etat-de-vue-atomes-par-feature.md)) après chaque
  édition qui touche un repère structure — add/rename/move/remove ; jamais les
  cues, jamais les syncs entrants (`setSections`, `restore`) qui rebondiraient.
- **Web / orchestration** — `useChartWithStructure` s'assoit sur la boîte
  (`useLatest` + effet, désarmée à l'unmount) et relabelle par la surface
  **silencieuse** du chart (`useChordChart`, pas le wrapper de session) : les
  repères sont l'origine de l'édition, re-dériver leurs identités en plein
  geste casserait drag et rename. Accords verbatim → offset de transposition
  conservé. Sans downbeat ou grille vide : la timeline garde ses repères, le
  texte n'est pas touché.
- **Tests** : TDD core (header d'une section unique connue), spec web
  `relabel-chart` (coupe/lone/strip/verbatim), spec `use-markers`
  (notification/silences), spec orchestration ×8 (rename/move/remove → grille
  suit, pas de re-mint des ids, offset conservé, sans downbeat intact, unmount
  désarme), **acceptation shell : sauvegarder → rouvrir → renommer un repère
  depuis l'inspecteur → le header de la grille suit**.
- PR **#358** ouverte (`feat/structure-marker-edits-relabel-chart`).

## Not done / remaining

- Le repli de la zone Analyse au rechargement cache toujours « Détecter la
  structure » (choix assumé : le panneau latéral des repères — toujours
  visible — est désormais l'éditeur de structure ; re-détecter serait un redo,
  pas un ajustement). À revoir si le signal beta persiste.
- Deux repères de structure dans la même mesure : le second bloc coupe à vide
  et son header disparaît du texte (comportement `cutBySections` existant) —
  divergence marker/texte possible sur ce bord, non traité.
- Premier repère ajouté à la main en milieu de morceau : la première section
  ouvre toujours à la mesure 0 (sémantique `cutBySections` établie par la
  détection) — le header coiffe le début du texte, pas le milieu.

## Decisions

- **L'autorité du sync devient « dernière édition gagne »** : la grille reste
  l'autorité quand ON TAPE dedans (sync grille→repères inchangé), les repères
  deviennent l'autorité quand on LES édite (nouveau sens, relabel silencieux).
  Les deux directions convergent car le relabel garde les accords verbatim.
- Boîte par store pour le câblage cross-feature (markers ne lit jamais les
  atomes du chart — l'orchestration s'assoit sur la boîte), conforme au motif
  « sac qui pilote une autre feature » (PR #302/#306).
- Comportement S.3b élargi volontairement : une détection à section unique
  garde désormais son header via le chemin partagé (cohérent avec le
  commentaire `headLoneRun` du core qui l'annonçait sans le câbler).

## Gate status

- typecheck : ✅ (via `pnpm gate`, arbre stampé `79b1a420`)
- tests (with coverage) : ✅ 178 fichiers / 2470 tests, couverture 91,39 % st.
- mutation (Stryker, local, diff) : ✅ score **92,46** ≥ seuil 90
  (`chart-structure.ts` 88,52 — module entier muté, pas seulement le diff)
- biome / sheriff / knip / jscpd : ✅ (un écart de format corrigé par
  `check:fix` avant le run vert)
- SonarCloud (PR #358) : ✅ quality gate « all conditions met », 0 issue
  ouverte, 0 hotspot à revoir.

## State to resume from

- **Single next action** : merger la PR #358 après CI verte, puis dérouler les
  priorités de la revue justesse design (PR #357) — en premier : trancher
  l'écart de quota (bug ou décision produit). Le lot « retour au labo » passe
  en tout dernier : les corrections/adoptions de la revue remontent ensuite au
  starter.
- Gotchas / half-done edits : aucun — branche propre, gate vert. Si le signal
  beta « structure » revient : les restes ci-dessus (repli Analyse, bords
  `cutBySections`) sont le point de départ.
