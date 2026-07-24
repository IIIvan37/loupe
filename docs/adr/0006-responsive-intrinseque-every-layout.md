# ADR 0006 — Responsive intrinsèque (Every Layout), zéro media query de viewport

- **Statut** : accepté
- **Date** : 2026-07-05 (décision prise en session
  [web-responsive-tactile](../sessions/2026-07-05-web-responsive-tactile.md) ;
  rédigé a posteriori le 2026-07-24, lot TS.3)

## Contexte

`packages/web` est bâti sur les primitives **Every Layout** (Cluster, Sidebar,
Stack… en composants) depuis le scaffold
([jalon 1, décisions de kickoff](../jalon-1-plan.md)). Les media queries de
viewport vont à contre-grain de ce système : elles codent en dur des seuils en
pixels que le layout intrinsèque rend inutiles, et chaque seuil est une
constante magique à maintenir en double (le CSS d'un côté, la réalité du
contenu de l'autre).

La passe responsive/tactile du 2026-07-05 l'a éprouvé : un premier jet avait
ajouté une media query compacte à `640px` et s'appuyait sur celle à `900px`
héritée du scaffold — il a été **refait** (historique nettoyé) dans le sens du
système, et l'état final a démontré que chaque cas se résolvait
intrinsèquement : reflow du header et de la barre de transport par `Cluster`
(`flex-wrap`), bascule deux-colonnes ⇄ empilé par un **Sidebar**
(`flex-basis` + `min-inline-size: 60%`), dimensions fluides par `clamp()`.

## Décision

- Le responsive de `packages/web` est **intrinsèque** : composition
  Cluster/Sidebar/Stack, `flex-wrap`, `flex-basis`, `min-inline-size`,
  `clamp()`. **Zéro media query de viewport.**
- La seule famille `@media` légitime est la **feature query** — détecter une
  modalité, pas une taille. Exemple en vigueur : `(pointer: coarse)` pour
  élargir les zones tactiles (`::after` transparent) sans changer le visuel.

## Conséquences

- Pas de seuils en pixels à maintenir : les points de bascule dérivent du
  contenu (la géométrie du Sidebar, ex. `0.6·W + panel ≈ W`), et survivent aux
  changements de contenu sans retouche.
- Les composants restent composables : aucun d'eux ne suppose une largeur de
  page, donc chacun marche dans un panneau, un dialog, un écran étroit.
- Le coût : penser chaque bascule en termes de géométrie flex plutôt que
  d'écrire `@media (max-width: …)` — moins direct au premier abord, et le
  premier jet refait de la session est la preuve que le réflexe breakpoint
  revient vite. Cet ADR est le garde-fou en revue : une media query de
  viewport dans un diff est un défaut, pas un choix de style.
- La règle n'est pas outillée par la gate — la revue (et cet ADR) la porte.

## Alternatives envisagées

- **Breakpoints de viewport classiques.** Rejeté : contre-grain du système de
  layout choisi au kickoff, seuils magiques dupliqués, et le premier jet qui
  en portait a été refait — les deux approches mélangées se contredisent.
- **Container queries.** Plus proches de l'esprit intrinsèque que les media
  queries de viewport, mais inutiles ici : la géométrie flex d'Every Layout
  couvre les cas réels sans introduire une seconde mécanique. À revisiter si
  un composant devait un jour se reconfigurer (pas seulement se reflower)
  selon son conteneur.
