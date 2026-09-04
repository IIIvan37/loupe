# Session — 2026-08-05 — récolte du module playback/

Première pièce du retour au labo starter : l'extraction ADR-0005 du cluster
nursery identifié depuis la revue justesse P2 (PR #361) et mûri par les lots
suivants — la règle de trois était atteinte depuis longtemps.

## Done

- **`core/src/playback/domain/`** naît par `git mv` de la tranche :
  `transport.ts` (machine `TransportState`), `playback-tick.ts`
  (`resolvePlaybackTick`, la politique du tick), `speed-trainer.ts`
  (politiques de rampe + `completesLoopPass`), `playback-rate.ts`
  (clamps tempo, tiré par le trainer) — et leurs specs.
- **La gate a énuméré la frontière** (le mécanisme ADR-0005 au travail) :
  deux violations Sheriff `feature:playback → feature:loops`, tranchées en
  une arête déclarée — le tick wrappe le playhead dans la région A/B armée,
  le trainer compte ses passes ; loops ne regarde jamais vers le transport.
- Chemins suivis : `index.ts` (surface publique inchangée pour web),
  `variant-discipline.spec.ts` (le chemin du reducer câblé), la note
  « pure playback domain » du registre application/README.md.
- Restent en nursery (pas de lien de dépendance, frontière non mûre) :
  `pitch-shift`, `seek-step`, `timecode` (attend son 2e consommateur),
  `viewport`, `key-bindings`, `bass-line`.

## Not done / remaining

- **Remontée au template `hexagonal-tdd-starter` : PR #35 ouverte**
  (specs de discipline généralisées — scan dynamique des `packages/*/src`,
  registres vides + exemples du terrain, pins à 0 —, règle Biome
  d'exhaustivité, workflow `/solid-review` en anglais avec `args.context`) ;
  gate du template vert, couverture 100 %. Merge côté template à suivre.
  L'extension mutation:diff hooks web n'est PAS portée : le template n'a
  pas de package web (résultat négatif documenté).

## Decisions

- Frontière du module = le cluster nommé par la revue (transport /
  playback-tick / speed-trainer) + `playback-rate` (dépendance directe du
  trainer, préfixe partagé) — rien de plus : une extraction n'aspire pas la
  nursery, elle emporte une tranche qui se lit d'un coup d'œil (ADR 0013).

## Gate status

- typecheck : ✅ (dans le gate)
- tests (with coverage) : ✅ — 91,41 % lines
- mutation (Stryker, `test:mutation:diff`, périmètre playback) : ✅ score
  92,28 (seuil 90), 3 min 56
- biome / sheriff / knip / jscpd / tokens / i18n / sonar-triage : ✅
  (`gate ok`, arbre stampé `49c8be12` ; Sheriff vert avec l'arête
  `playback → loops` déclarée)
- SonarCloud (PR #372) : ✅ quality gate OK, 0 issue, 0 hotspot

## State to resume from

- **Single next action** : ouvrir la PR de l'extraction ; ensuite la
  remontée au template starter (cloner `IIIvan37/hexagonal-tdd-starter`,
  porter les specs de discipline + workflow + mutation-diff web).
- Gotchas : `check:sonar` échouerait si une exemption nommait un fichier
  déplacé — vérifié, aucune ne pointait le cluster ; le scope mutation-diff
  du module est `playback` (segment automatique).
