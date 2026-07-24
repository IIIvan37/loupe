# Décisions d'architecture

Pourquoi les contraintes de ce dépôt existent — pour que le prochain lecteur ne
« simplifie » pas celle qui portait tout.

## Quand en écrire un (et quand non)

Un ADR et un session report ne sont **pas** le même artefact, et la frontière
mérite d'être gardée nette :

| | [`docs/sessions/`](../sessions/) | ici |
|---|---|---|
| Indexé par | date | sujet |
| À lire pour | **reprendre** le travail | **changer** une contrainte, des mois plus tard |
| Contient | ce qui a été fait, où on en est, la prochaine action | le pourquoi, les alternatives rejetées, les coûts acceptés |
| Durée de vie | périmé à la session suivante | vivant tant que la contrainte l'est |

**Écrire un ADR** quand un changement touche une frontière, un invariant ou la
toolchain — ce que quelqu'un sera plus tard tenté de défaire sans savoir
pourquoi ça existe. C'est rare ; la plupart des étapes n'en demandent aucun.

**Ne pas** répéter le raisonnement dans le session report : sa section
`Decisions` pointe ici. Une seule explication canonique, un seul endroit à
mettre à jour.

Copier [`_TEMPLATE.md`](_TEMPLATE.md). Numéroter séquentiellement ; ne jamais
réécrire un ADR accepté — le remplacer par un nouveau et mettre à jour le
statut de l'ancien.

## Provenance

La pratique vient du template [`hexagonal-tdd-starter`](https://github.com/IIIvan37/hexagonal-tdd-starter)
(lot TS.3 du [plan de resynchronisation](../template-sync-plan.md)). Les ADR
0001 à 0005 adaptent au contexte de loupe ceux du template qui s'y appliquent ;
les ADR 0006 à 0009 actent des décisions propres à loupe qui n'avaient
jusqu'ici que des session reports ou CLAUDE.md comme trace. Deux ADR du
template n'ont pas été repris car spécifiques au starter : « bounded project
state » (le bornage mécanique des docs d'état) et « frontend-agnostic starter »
(loupe possède son UI, la question ne se pose pas).

Fait notable : l'ADR « modules émergents » du template a été écrit à partir de
l'analyse du core de **loupe** (anonymisé en « field project ») ; sa version
locale ([0005](0005-modules-emergents.md)) rétablit les vrais chiffres et les
vrais fichiers.

## Index

| # | Décision | Statut |
|---|----------|--------|
| [0001](0001-typescript-strip-only-sans-build.md) | Livrer les sources TypeScript, sans étape de build pour le core | accepté |
| [0002](0002-contrats-de-ports-en-subpath-testing.md) | Les obligations des ports vivent dans des contrats, servis par `@app/core/testing` | accepté — mise en œuvre au lot TS.4 |
| [0003](0003-etat-ambiant-derriere-des-ports.md) | L'état ambiant (temps, ids) entre dans le core en valeurs, jamais en globaux | accepté |
| [0004](0004-erreurs-attendues-valeurs-taguees.md) | Les échecs attendus sont des valeurs taguées ; les bugs crashent | accepté — migration au fil de l'eau |
| [0005](0005-modules-emergents.md) | Les modules de feature se découvrent, ils ne se décrètent pas | accepté — mise en œuvre au lot TS.5 |
| [0006](0006-responsive-intrinseque-every-layout.md) | Responsive intrinsèque (Every Layout), zéro media query de viewport | accepté |
| [0007](0007-offload-calcul-audio-modal.md) | Le calcul audio lourd part sur Modal ; le cloud calcule et oublie | accepté |
| [0008](0008-copy-ui-lingui-ids-semantiques.md) | La copy UI passe par Lingui : ids sémantiques, catalogue source français, infinitifs | accepté |
| [0009](0009-time-stretch-soundtouch.md) | Time-stretch via SoundTouch (MPL-2.0), pas Rubber Band (GPL) | accepté |
