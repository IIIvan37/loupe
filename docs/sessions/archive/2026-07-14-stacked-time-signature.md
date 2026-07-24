# Session — 2026-07-14 — stacked time signature (notation)

## Done

- **Demande utilisateur (pré-démo)** : la signature rythmique doit se lire
  comme sur le chart de référence (`your-song-elton-john-chart.pdf`) — un
  glyphe EMPILÉ (4 sur 4) au début du premier système, pas un texte « 4/4 ».
  Approche validée par l'utilisateur : fidèle au PDF, le texte du header meta
  disparaît (la signature vit dans la grille).
- **`TimeSignature`** (dumb, `time-signature.tsx`) : numérateur empilé sur le
  dénominateur, `role="img"` + `aria-label="4/4"` (le lecteur d'écran dit
  « 4/4 », pas « 4 4 ») ; une valeur non `N/M` (directive libre) s'imprime
  verbatim.
- **LeadSheet** : signature de tête = `{time:}` du source, sinon
  `beatsPerBar` de session (`N/4`) — même précédence que les autres champs de
  tête ; rendue dans la gouttière avant la barre d'ouverture du premier
  système (`.headSignature` absolue, `right: 100%`, centrée sur la première
  ligne de mesures ; gouttière = `padding-left` du `.sheet`, réservée en
  permanence pour que la grille ne saute pas quand le mètre arrive).
- **Changements de mètre** : l'annotation texte « 2/4 » en coin de mesure
  devient le même glyphe empilé (petit, `.meterSign`).
- **ChartHeader** : le champ signature retiré (calcul + rendu + CSS
  `.chartSignature`) — la signature n'est plus un champ de tête.
- **Vérif navigateur** (The Logical Song, source avec `{time: 4/4}` de tête +
  changement `{time: 2/4}` mid-grid) : rendu conforme au PDF — 4-sur-4 en
  gouttière avant la double barre, 2/4 et retour 4/4 empilés dans leurs
  mesures, header meta sans « 4/4 ».

## Not done / remaining

- Le PDF met la signature uniquement au tout début ; nos changements mid-grid
  (hors-PDF) restent dans la mesure — cohérent avec l'existant, validé visuel.
- Vérif navigateur pré-démo sur The Logical Song détecté bout-en-bout (après
  merge des PRs #130 + celle-ci) toujours au reste-à-faire du STATUS.

## Decisions

- La signature est de la NOTATION (contenu du document, comme ♩ et les
  lettres d'accords) : pas d'entrée catalogue Lingui ; l'accessibilité passe
  par `aria-label` sur un `role="img"`.
- La gouttière est réservée sur toutes les feuilles (pas conditionnelle) pour
  éviter le décalage de mise en page à l'arrivée du mètre.

## Gate status

- typecheck : ✅ (`pnpm gate` exit 0)
- tests (with coverage) : ✅ 1405 tests (lead-sheet +4, chart-header −2 :
  les trois tests signature du header remplacés par un test d'absence)
- mutation (Stryker) : **skippé — core intouché** (slice 100 % packages/web)
- biome / sheriff / knip / jscpd / impeccable / react-doctor : ✅ (gate exit 0)

## State to resume from

- **Single next action** : ouvrir la PR de cette branche
  (`feat/stacked-time-signature`), puis merger #130 et celle-ci et faire la
  vérif navigateur pré-démo complète sur The Logical Song.
- Gotchas : `.headSignature` est absolue dans le `.row` (relatif) du premier
  section ; la gouttière vient du `padding-left` du `.sheet` — si un jour le
  sheet doit coller à gauche, penser à la conditionner.
