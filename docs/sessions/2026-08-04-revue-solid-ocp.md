# Session — 2026-08-04 — revue SOLID, lot OCP (unions recopiées)

Premier des trois lots de solde du backlog revue SOLID (rapport
`2026-08-04-revue-solid.md`) : les trois constats OCP — des jeux de variantes
recopiés à la main que le compilateur ne pouvait pas tenir d'accord.

## Done

- **Union transport partagée** (constat n° 1, medium) :
  `AnalysisTransportErrorCode` naît dans `core/src/shared/analysis-transport.ts`
  (`engine-unavailable | network | timeout | too-large`) ; les 4 unions
  d'erreur (séparation, tempo, accords, structure) la composent, les 3 classes
  d'erreur la portent en `code` (mort des ré-épellations inline et du
  `Exclude<>` local de detect-tempo) ; côté web `TransportFailure` est
  supprimé — `post-wav-json.ts` parle le type du core. Un futur code (l'échec
  auth/quota du chantier offload) atterrit en UNE ligne core.
- **Copy transport partagée** : `detection-copy.ts` factorise les faces à
  formulation identique (`engine-unavailable`, `unknown`) dans
  `SHARED_TRANSPORT_COPY`, étalé dans les 4 Records — ids unifiés
  `analysis.error.*` sur le précédent du `network` (catalogue : −8 entrées
  dupliquées, +2 partagées) ; `timeout`/`too-large` restent par flux (leur
  copy nomme l'analyse).
- **`isSeparationPhase`** (constat n° 2, low) : la liste des phases devient
  l'unique source (`SEPARATION_PHASES` → type + prédicat, TDD), exportée du
  core ; `analyser-row` (le `running` en disjonction silencieuse),
  `analysis-summary` (l'énumération du complément) et le type de
  `SEPARATION_PROGRESS_LABELS` (`Record<SeparationPhase, …>`) dérivent tous
  du même point — une 4e phase est une erreur de compilation partout.
- **`command satisfies never`** (constat n° 3, low) : le `default` du switch
  de `dispatch()` (use-keyboard-shortcuts) force l'exhaustivité que son
  jumeau `describeCommand` avait déjà par son type de retour.

## Not done / remaining

- Lots LSP (replay du contrat `ProjectStore` sur l'adaptateur HTTP + fakes de
  `shell-test-kit`) et ISP (seams consommateurs du `Mixer`) — les deux autres
  lots du backlog.
- Verdict Sonar de cette PR : à lire après le passage du CI (`pnpm sonar`).

## Decisions

- Le vocabulaire des échecs transport appartient au **core** (`shared/`), pas
  à l'adaptateur HTTP : c'est le contrat que les 4 flux promettent à l'UI,
  l'adaptateur ne garde que l'interprétation des statuts HTTP.
- Ids Lingui partagés (`analysis.error.*`) quand la formulation est commune à
  tous les flux — le précédent `analysis.error.network-offload` généralisé.

## Gate status

- typecheck : ✅ (dans le gate)
- tests (with coverage) : ✅ — 91,52 % statements / 89,46 % branches
- mutation (Stryker, local, `test:mutation:diff`) : ✅ score global 92,18
  (seuil 90) — 17 min, périmètre = modules core touchés par la branche
- biome / sheriff / knip / jscpd / tokens / i18n / sonar-triage : ✅
  (`gate ok`, arbre stampé `9eba6d36`)
- SonarCloud : en attente du CI de la PR (analyse ~5 min post-push)

## State to resume from

- **Single next action** : ouvrir la PR de ce lot, puis enchaîner le lot LSP
  (brancher depuis `main` à jour après squash-merge — jamais depuis cette
  branche).
- Gotchas : les ids `<flux>.error.engine-unavailable` / `<flux>.error.unknown`
  n'existent plus — toute spec qui les résolvait doit viser
  `analysis.error.*` (fait pour analyser-row.spec et
  workstation-shell.tempo.spec).
