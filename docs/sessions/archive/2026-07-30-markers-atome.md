# Session — 2026-07-30 — la liste des repères en atome (ADR 0010)

## Done

- **Première feuille « sacs de feature en atomes »** (branche
  `refactor/markers-atom`) : la liste des repères passe dans `markersAtom`
  (`marker-atoms.ts`, module markers). `useMarkers` garde **toutes** les
  transitions (mint d'identité + libellé auto, rename/move/remove/sections/
  clear/restore) — seul le stockage change (`useAtom` au lieu de `useState`) :
  le hook devient appelable par n'importe quel consommateur, tous voient la
  même liste de session.
- **`ShellMain` et `ShellStage` lisent les repères elles-mêmes** : le prop
  `markers` tombe des deux régions. Cliquets descendus dans la même PR :
  `MAX_RETURN_TYPE_PROPS` **21 → 19**, `MAX_PROPS_FIELDS` **22 → 21**
  (`ShellMainProps` reste le plus large).
- Spec dédiée `use-markers.spec.tsx` (rouge d'abord) : deux consommateurs
  sous le même `Provider` partagent la liste et toutes les transitions ;
  deux montages séparés restent isolés (un store par test).

## Not done / remaining

- Le shell appelle toujours `useMarkers()` pour ses orchestrateurs
  (`useProjectSession`, `useShellShortcuts`, `useChartWithStructure`) — ils
  prennent le sac en dépendance ; c'est sain (ce sont des consommateurs comme
  les autres), rien à migrer tant qu'un cliquet ne le réclame pas.
- **19 props `ReturnType` restants** : `viewport`, `mixer`, `loops`,
  `loopEditing`, `separation`, `tempo` (et leurs redescendus). Prochains
  candidats : `tempo` (l'analyse est déjà dans `tempoAnalysisAtom`) ou
  `mixer`.
- L'**interface étroite de session (DIP)** reste en feuille d'après.

## Decisions

- Aucune décision nouvelle : la feuille applique l'ADR 0010 tel quel (état de
  vue en atome par feature, transitions gardées par le hook porteur —
  garde anti-érosion inchangée).
- Module watch : aucun signal côté core (aucune source core touchée).

## Gate status

- `pnpm gate` ✅ complet (tampon `00bd51c5`) : typecheck ✅ · biome ✅ ·
  sheriff ✅ · design/react ✅ · tokens/i18n ✅ · knip ✅ · jscpd ✅.
- tests : ✅ 2415/2415 (173 fichiers), couverture 96,8 % statements /
  92,3 % branches.
- mutation : **sans objet** — aucune source core touchée (web uniquement).
- sonar : à lire une fois l'analyse CI de la PR #301 posée (~5 min après le
  push) — vérifier avant merge.

## State to resume from

- **Single next action** : feuille 0010 suivante — passer un autre sac en
  atomes (candidat : `tempo`, dont l'analyse vit déjà dans
  `tempoAnalysisAtom` ; sinon `mixer`) pour continuer à descendre les 19
  props `ReturnType` ; puis l'interface étroite de session (DIP).
- Gotchas :
  - `useMarkers` est désormais de l'état partagé : toute spec qui le monte
    (directement ou via une région) doit passer sous un `Provider` jotai
    frais, sinon le store par défaut fuit entre tests.
  - Le mint d'identité/libellé reste DANS le hook — ne jamais écrire dans
    `markersAtom` depuis un composant ou un autre module (garde ADR 0010).
