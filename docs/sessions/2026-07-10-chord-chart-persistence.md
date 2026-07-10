# Session — 2026-07-10 — persistance de la grille d'accords

Branche `feat/chord-chart-persistence` (off `main`, Lot A/B mergé PR #77).
Deuxième slice du plan [chord-charts-plan.md](../chord-charts-plan.md) — la
persistance qui complète le Lot A.

## Done
- **Acceptance shell d'abord (outside-in, RED honnête)** : le premier jet du
  test de reopen passait *vacuement* (l'état local du panneau survivait au
  reopen — les commits `loading`/`loaded` se coalescent, le panneau ne démonte
  pas). Durci : après la sauvegarde on importe un **autre fichier** (grille
  perdue), puis on rouvre — la grille ne peut alors revenir que du manifest.
  4 tests : reopen restaure le texte verbatim + le rendu ; un projet sans
  grille rouvre « Enregistré » avec la grille vide ; éditer la grille passe la
  session « Non enregistré » ; un import frais repart grille vide.
- **Core** : `ProjectChordChart { source }` sur `Project`/`SessionSnapshot`
  (+ `projectFromSession`) et `SaveProjectInput` (+ `saveProject`). **Le texte
  source est ce qui est persisté** — c'est l'édit de l'utilisateur, préservé
  verbatim (formatage compris) ; le `ChordChart` parsé reste dérivé au rendu
  (même règle que la tempo-map jamais persistée).
- **Web** :
  - [use-chord-chart.ts](../../packages/web/src/app/lead-sheet/use-chord-chart.ts) :
    l'état source **lifté au shell** (le panneau démonte pendant un chargement
    de piste — l'état de session ne peut pas y vivre) ;
    `ChordChartPanel` devient **contrôlé** (`source`/`onSourceChange`).
  - `sessionSaveInput`/`restoreSession` : la grille voyage avec le manifest ;
    absent ⇔ vide (un manifest d'avant le champ restaure une grille vide,
    jamais « ce que la session précédente avait tapé »).
  - `sessionSignature` signe le texte (absent ⇔ '' ⇔ null — les vieux
    manifests signent « Enregistré ») ; la sauvegarde ne persiste la grille
    que si le texte a du contenu réel (`trim() !== ''`).
  - `startFreshTrack` reset la grille (import fichier/URL/open).
- **react-doctor** a flaggé le shell à 302 lignes (les câblages count-in +
  grille l'ont poussé au seuil) → extraction de
  [use-shell-drop.ts](../../packages/web/src/app/workstation-shell/use-shell-drop.ts) :
  toute l'histoire du drop OS (overlay, confirm, warning non-audio + son
  désarmement au chargement) en un hook, comportement préservé.

## Not done / remaining
- Transposition UI (tirera `transposeChordSymbol`, toujours non exporté) et
  `transposeChart`.
- Lead-sheet : bars-per-row configurable, surlignage mesure courante
  (`BeatGrid`), style print/PDF — incréments Lot B restants.
- Lot C (ACE serveur BTC) : non commencé ; pré-requis = les deux angles morts
  du plan (spike Demucs, dispo poids).
- Vérif navigateur de la persistance : couverte par l'acceptance jsdom
  (round-trip save/open complet sur fake stores) ; un tour navigateur
  save/reopen réel reste souhaitable au prochain passage serveur allumé.

## Decisions
- **On persiste le texte source, pas l'AST** : lossless (formatage/retours
  ligne), signature triviale, et le modèle parsé reste une dérivation — une
  seule source de vérité.
- **Absent ⇔ vide** partout (signature, restore) : les vieux manifests
  rouvrent « Enregistré » ; une grille en espaces seuls n'est pas une grille
  (trim au save et à la signature via le même `liveChordChart`).
- **L'état grille vit au shell** : le panneau est monté/démonté au gré du
  chargement — un état de session ne survit pas dans un composant feuille.

## Gate status
- typecheck: ✅
- tests (with coverage): ✅ **841 passed** (+9 : 4 acceptance shell, 2 domaine,
  1 application, 2 signature ; panel spec adaptée au contrôlé) — coverage
  96,18 %/89,5 % env. (seuils 85/80)
- mutation (Stryker, local — core touché): ✅ (voir note du run dans la PR ;
  `project.ts`/`projects.ts` : champs threadés couverts par specs dédiées)
- biome / sheriff / knip / jscpd (7 clones, stable) / impeccable /
  react-doctor: ✅ (le warning « large component » levé par l'extraction
  `useShellDrop`)

## State to resume from
- **Single next action** : ouvrir la PR de `feat/chord-chart-persistence`,
  puis **la transposition UI** (exporter `transposeChordSymbol`, écrire
  `transposeChart`, boutons ± demi-ton sur le panneau) ou un incrément
  lead-sheet (bars-per-row / surlignage mesure courante).
- Gotchas :
  - `useChordChart.setSource` sert aussi de `restoreChordChart` (même geste) ;
    si un jour restaurer ≠ taper (ex. marquer pristine), scinder à ce
    moment-là.
  - La grille ne se persiste que trimmed-non-vide ; le test « chart-less »
    verrouille la symétrie absent ⇔ vide.
