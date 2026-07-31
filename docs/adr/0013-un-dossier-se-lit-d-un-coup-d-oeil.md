# ADR 0013 — Un dossier se lit d'un coup d'œil : rôles, dossiers de composant, cliquet

- **Statut** : accepté
- **Date** : 2026-07-31

## Contexte

Le découpage par feature (ADR [0005](0005-modules-emergents.md) côté core,
[0012](0012-graphe-de-modules-web.md) côté web) borne les dépendances, pas la
**forme interne** d'un dossier. Mesuré sur `packages/web/src` (2026-07-31) :
`app/workstation-shell` et `audio` portaient chacun **31 fichiers source à
plat** (61 et 44 entrées en comptant specs et CSS colocalisés). Un listing de
60 entrées ne se lit plus : on navigue au grep, plus à l'œil, et chaque
fichier ajouté aggrave en silence — aucun détecteur du gate ne le voyait.

Trois natures cohabitaient dans le shell — précisément les trois seaux de
l'[ADR 0011](0011-shell-layout-contexte-session-audio.md) : régions/layout,
orchestrateurs, cycle de vie app. Dans `audio` : adaptateurs HTTP, lecture
Web Audio, encodage, pont Tauri, factories. Le rôle existait dans les
préfixes de noms (`shell-*`, `use-*`, `http-*`, `web-audio-*`) ; il suffisait
de le matérialiser.

## Décision

Trois règles, une contrainte mécanique :

1. **Sous-dossiers par rôle.** Un dossier de feature qui déborde se range par
   rôle *local* (`workstation-shell/{regions,orchestration,lifecycle}`,
   `audio/{http,playback,encode,tauri}`) — jamais par type technique global
   (`hooks/`, `components/`), qui disperserait une feature au lieu de la
   ranger. Sheriff n'y voit rien : un sous-dossier reste dans le module de la
   feature (le placeholder `app/<feature>` ne matche qu'un segment).

2. **Un composant à compagnons vit dans son dossier dédié** — le composant,
   sa spec, son CSS module ensemble (`empty-state/empty-state.tsx` + spec +
   css). Précédent : le kit layout (`layout/cluster`, `layout/stack`). Un
   composant sans compagnon reste un fichier ; un dossier d'un seul fichier
   n'apporte rien.

3. **Les specs colocalisées et le CSS restent gratuits.** La colocation est
   une convention voulue ; le problème est le nombre de *sources*, pas leurs
   compagnons.

4. **Un `composes` CSS inter-dossiers passe par l'alias racine `@/`**
   (`from '@/app/ui/controls.module.css'`, alias déclaré dans
   `packages/web/vite.config.ts`) ; seul un `composes` intra-dossier reste
   relatif (il déménage avec son fichier). Le CSS est l'angle mort de
   l'outillage : un import TS cassé tombe au typecheck, un `composes` cassé
   ne tombe qu'au `vite build` — la profondeur d'un fichier ne doit donc pas
   s'encoder dans les feuilles de style voisines. Les imports **TS restent
   relatifs** à dessein : typecheck, Sheriff et biome les gouvernent, et un
   déplacement se réécrit mécaniquement.

**Le cliquet** : `packages/web/src/folder-shape.spec.ts` borne les sources
directes (`.ts`/`.tsx` hors `.spec.*`/`.d.ts`) par dossier —
`MAX_FLAT_SOURCES`, démarré au présent mesuré post-rangement (16), ne monte
jamais, descend d'un cran quand une feuille range un dossier (même mécanique
que les cliquets de l'ADR 0010).

## Conséquences

- Le rangement est **progressif** : cette décision range les deux offenders
  (shell, audio) ; `ui` (16), `lead-sheet` (16) suivront en feuilles dédiées,
  chacune baissant le cliquet.
- Déplacer un fichier a des coûts périphériques que le gate attrape : les
  exemptions Sonar nomment des chemins (`check:sonar` casse si l'un bouge),
  les commentaires de référence du catalogue Lingui aussi (`check:i18n`
  re-extrait), les liens des living docs (link-checker).
- Le core n'est pas couvert : sa forme est gouvernée par l'extraction de
  modules émergents (ADR 0005, `modules:hint`), pas par un cliquet de dossier.
