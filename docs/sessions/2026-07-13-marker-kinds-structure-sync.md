# Session — 2026-07-13 — marker-kinds-structure-sync

Point #2 du lot pré-démo : répercuter les éditions manuelles de la structure
sur les marqueurs, via deux types de marqueurs (structure / indicatif).

## Done

- **Modèle (core)** : `Marker.kind?: 'structure'` — optionnel, absent ⇔
  indicatif (cue). Rétro-compatible : la persistance porte la `MarkerList`
  verbatim, les vieux projets restaurent leurs marqueurs en indicatifs.
- **Domaine pur (TDD)** :
  - `replaceStructureMarkers(list, structural)` (marker-list) — remplace les
    marqueurs de structure, préserve les indicatifs, ordre temporel conservé.
  - `chartSectionAnchors(source, grid)` (chart-structure) — un ancrage par
    en-tête `[Section]` étiqueté, à l'instant du downbeat où sa première mesure
    se **joue** pour la première fois (`unrollChart` — cohérent avec S.3b et le
    surlignage). Skips mesurés : label vide, en-tête sans mesure (frappe en
    cours), section hors grille, section jamais jouée (al Fine), pas de
    downbeat.
- **Web** :
  - `useMarkers.setSections` remplace désormais les **structure seulement**
    (mint `kind: 'structure'`, indicatifs préservés) — la détection ne balaie
    plus les repères posés à la main.
  - `syncStructureMarkersFromChart` (chart-marker-sync) + callback
    `onSourceEdited` sur `useChordChartSession` : chaque **édition utilisateur**
    de la source (frappe live, brouillon détecté) re-dérive les marqueurs de
    structure. **Jamais au restore/reset/transpose** — une correction manuelle
    sauvegardée survit à la réouverture. Garde : sans downbeat, on ne touche à
    rien (les marqueurs seconds-based d'une détection sans grille survivent).
  - Rail : `data-kind` + peau **teal** (règle des tokens : ambre = à vous,
    teal = dérivé/détecté) pour les marqueurs de structure ; ils restent
    **éditables mais écrasables** (décision produit — certains marqueurs
    détectés sont faux sur Logical Song, on veut pouvoir les corriger vite ;
    la prochaine édition de grille les re-dérive).
  - Confirmation « Détecter la structure » précisée : ne s'arme que si des
    marqueurs **de structure** seraient remplacés (`hasMarkers` filtre par
    kind) ; copy « Remplacer les repères de structure ? » (+ variante both).
    Catalogue ré-extrait.
  - Signature de session : `kind` inclus dans le tuple marqueur.
- **Acceptance shell** : en-tête tapé ⇒ marqueur live, grille vidée ⇒ marqueur
  retiré ; cue survivant à une détection **et** à une édition de grille ;
  round-trip persistance des **deux kinds** (structure re-peint teal à la
  réouverture, sans re-dérivation).

## Decisions

- **Grille = autorité** : les `[Section]` du texte pilotent les marqueurs de
  structure ; pas de propagation inverse (rail → texte).
- **Éditables/écrasables** sur le rail (pas de read-only) : corriger vite un
  marqueur détecté faux prime ; l'écrasement à l'édition de grille est assumé.
- **Sync sur éditions utilisateur uniquement** (setSource/seatDraft), pas au
  restore — protège les corrections sauvegardées.
- Un seul kind nommé (`'structure'`), l'indicatif = absence de kind.

## Limites v1 (notées)

- Grille tapée **avant** que le tempo n'arrive : les marqueurs n'apparaissent
  qu'à l'édition suivante (pas d'effet au « grid arrive » — voulu, c'est ce qui
  protège le restore).
- Frappe live : un en-tête incomplet (`[Cou`) fait brièvement flotter les
  ancrages (cohérent avec la feuille qui rend déjà en direct).
- Vieux projets : d'anciens marqueurs de section (sans kind) restaurent en
  indicatifs — une édition de grille peut alors les doubler ; l'utilisateur les
  supprime à la main.

## Gate status

- typecheck / biome / sheriff / knip / jscpd : **vert** (`pnpm gate` EXIT 0).
- tests : **1340** (+18), couverture ~96 %.
- mutation (Stryker) : **≥ 93,96 %** — marker-list **100 %**, chart-structure
  92,6 % (survivants restants pré-existants + 1 garde équivalente ; le mutant
  `indexOf === -1` tué par le test al-Fine).

## State to resume from

- **Single next action** : ouvrir la PR `feat/marker-kinds-structure-sync`.
- Ensuite : point #3 pré-démo — signatures rythmiques (4/4, 2/4 et
  changements) ; voir la mémoire `chord-grid-demo-prep`.
