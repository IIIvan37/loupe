# Session — polish : modales raccourcis & projets

**Date** : 2026-07-20
**Branche** : `feat/ui-dialog-polish` (part de `main`)

Deux irritants UI remontés à l'usage (hors roadmap, cap UX).

## `AppDialog` — variante large

Prop `wide` optionnelle sur le cadre partagé : panneau `min(46rem, …)` au lieu
de `28rem` ; `max-height` + `overflow-y:auto` posés au passage (une modale haute
ne déborde plus l'écran).

## Modale des raccourcis — large + deux colonnes

`ShortcutsDialog` passe `wide` ; sa `.list` devient une grille
`repeat(auto-fit, minmax(17rem, 1fr))` — deux colonnes quand la place suffit,
une seule sinon (intrinsèque, pas de media query). Vérifié navigateur : la liste
clavier + la section Gestes se répartissent sur deux colonnes, bien plus
lisibles.

## Modale des projets — nom non tronqué

`ProjectsDialog` passe `wide` ; la ligne d'un projet est refondue :
le **nom occupe une ligne pleine et retourne à la ligne** (`flex: 1 1 100%`,
`overflow-wrap: anywhere`, fini l'`ellipsis`) — un projet reste lisible quelle
que soit la longueur du titre ; la date (`margin-inline-end: auto`) pousse les
actions renommer/ouvrir/supprimer à droite de la seconde ligne.

## Gate

Verte — **1925 tests**, react-doctor clean, check:tokens clean, typecheck 0.
Modale projets vérifiée par spec + typecheck (desktop-only depuis AJ.3, non
ouvrable dans le navigateur) ; modale raccourcis vérifiée navigateur.
