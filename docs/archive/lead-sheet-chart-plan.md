# Plan — Lead-sheet façon « chart » (Lot P)

> Statut (2026-07-12) : **plan validé** (trois arbitrages produit pris ce jour,
> voir « Décisions »). Référence visuelle : le PDF « Your Song » (Elton John,
> chordsheet.com) fourni localement à la racine du repo — **non versionné,
> document sous droits**. Chaque slice UI passe par le checkpoint d'approche
> (2–3 lignes contre la maquette) avant son test d'acceptation.

## Ce que la maquette montre (inventaire)

- **En-tête** : `key of E♭` (haut gauche, petit), `♩=128` (haut droite), titre
  « Your Song (Capo 3rd fret) » + artiste « Elton John » ; ligne méta : label
  de section encadré + style (« pop ballad ») + crédit (« lyrics by Bernie
  Taupin ») ; chiffrage `4/4` devant la première mesure. Pied de page : source,
  `page 1 of 1`, date d'édition.
- **Sections encadrées** : Intro, Verse, Chorus, Coda (précédée du signe ⊕),
  Outro. Une trentaine de mesures écrites décrivent un morceau bien plus long.
- **Barres de mesure dessinées** : simple `|`, double d'ouverture/fermeture
  `‖`, reprises `|:` `:|`, **voltas** 1. / 2. (crochets au-dessus des mesures),
  marque **D.C.** au-dessus d'une barre, **point d'orgue** sur le dernier
  accord.
- **Typographie d'accord** (police manuscrite type Petaluma) : fondamentale en
  grand, **qualité en exposant** (Fᴹᴬ⁷, Dm⁷, E⁷), **slash chords empilés**
  (F au-dessus, /C en dessous-droite). 4 mesures par ligne, colonnes alignées.

## Ce qui existe déjà (carte)

- `domain/chord-chart.ts` : grammaire texte `| C | Am |` + labels `[Section]`,
  `parseChart` → `sections → measures → chords`, `renderChartSource`,
  transposition **du texte source** (layout préservé), `transposedBy`.
- `domain/chord-symbol.ts` : `parseChordSymbol` décompose déjà fondamentale /
  qualité / basse slash — le rendu typographique a sa structure toute prête.
- LeadSheet (K.1) : scrollport borné, suivi du playhead (`measureIndexAt`
  linéaire : mesure i ↔ i-ème downbeat), footer sticky, bars-per-row persisté.
- Session : tags du fichier (titre/artiste), tonalité détectée (key chip),
  BPM + `beatsPerBar` du beat grid — tout ce qu'il faut pour dériver l'en-tête.
- Le PDF n'apporte **aucune dépendance** : parser + rendu maison, zéro lib
  (décision chord-charts-plan #3, maintenue).

## Décisions produit — arbitrées (2026-07-12)

1. **Ordre → rendu d'abord.** P.1 livre la typographie chart sur la grammaire
   actuelle (valeur visuelle immédiate, zéro risque modèle) ; la forme
   (reprises/voltas/unroll) vient en P.2 — même principe « couche facile
   d'abord » que le plan chord-charts.
2. **Sync lecture → suit les reprises dès P.2.** L'unroll pur forme → suite de
   mesures jouées fait partie de la slice domaine ; le surlignage suit l'ordre
   réellement joué (deux passages d'un couplet = deux surlignages successifs).
3. **En-tête → dérivé + surchargeable.** Par défaut tiré de la session (tags,
   tonalité détectée, BPM arrondi, chiffrage du grid) ; des directives
   optionnelles en tête de source (`{title: …}`, `{artist: …}`, `{style: …}`,
   `{key: …}`, `{tempo: …}`) surchargent — le document reste autoportant.

## Les slices

### P.1 — Rendu chart : typographie & habillage *(UI — checkpoint d'approche)*

- Composant pur `ChordGlyph` : fondamentale en grand, qualité en exposant,
  basse slash empilée — alimenté par `parseChordSymbol` (aucun changement de
  grammaire). Un token que le parseur ne re-imprime pas à l'identique s'affiche
  verbatim (même garde que la transposition).
- Habillage de la grille : barres de mesure dessinées (simple, double aux
  frontières de section et en fin de chart), labels de section **encadrés**,
  4 mesures/ligne par défaut (préférence existante conservée). CSS
  Grid + tokens du design system, zéro média query (Every Layout).
- **En-tête dérivé** : titre/artiste (tags), `key of X` (détection), `♩=BPM`,
  chiffrage — plus les directives de surcharge `{…}` (parseur : lignes `{k: v}`
  en tête de source, ignorées par la grille). Police : une fonte « chart »
  chargée localement (à choisir au checkpoint — licence libre obligatoire).
- Le suivi du playhead et l'édition existants continuent de fonctionner tels
  quels (grammaire inchangée).

### P.2 — Grammaire de forme + déroulement *(domaine — TDD strict, autonomie)*

- Étendre la grammaire texte : reprises `|:` … `:|`, voltas `|1.` / `|2.`
  (barre de fin de volta = `:|` pour 1., `|` pour la dernière), `{d.c.}` /
  `{coda}` / `{fine}` en directives de ligne, point d'orgue en suffixe de
  token (proposition — la syntaxe exacte se fige au premier test rouge,
  documentée dans le README de l'application).
- `unrollChart` **pur** : forme → suite ordonnée de références de mesures
  jouées (l'index écrit de chaque occurrence), avec gardes sur les formes
  dégénérées (volta sans reprise, D.C. sans coda…).
- Sync lecture : `measureIndexAt` mappe le n-ième downbeat sur la n-ième
  mesure **déroulée** ; le surlignage suit l'ordre joué. Si la forme déroulée
  et le beat grid divergent en longueur, comportement actuel conservé
  (surlignage clampé) — pas d'heuristique spéculative.
- Transposition : les nouveaux tokens de structure passent verbatim (même
  patron que `[Section]` aujourd'hui). Rendu des reprises/voltas/D.C./⊕ dans
  la vue chart (extension de P.1).

### P.3 — Édition repliée *(UI — checkpoint d'approche)*

- La vue par défaut du panneau est **la chart en lecture seule**, synchronisée
  à la lecture ; la textarea sort du flux permanent — bascule « Modifier »
  explicite (l'approche exacte : toggle en place vs dialog, à trancher au
  checkpoint contre la maquette). La ligne « Détecter les accords » reste en
  tête de panneau (N.4).
- La préférence bars-per-row et le brouillon de détection continuent de viser
  la source texte — l'édition repliée ne change pas le modèle, que la vue.

### P.4 — Impression *(veille, à inscrire si l'usage le réclame)*

- La maquette est une page imprimée : une feuille de style `@media print`
  (chart seule, en-tête + pied de page) est le prolongement naturel de P.1 —
  quelques dizaines de lignes, à faire au fil de l'eau plutôt qu'en slice.

## Risques & garde-fous

- **L'unroll est le seul point dur** : formes dégénérées, D.C. imbriqués,
  voltas orphelines. Il est pur et se teste en propriété (fast-check) :
  « l'unroll d'une forme sans structure est l'identité », « chaque mesure
  déroulée référence une mesure écrite ».
- **Divergence chart ↔ grid** : une forme déroulée de 100 mesures sur un grid
  de 98 downbeats ne doit pas casser le surlignage (clamp, comme aujourd'hui).
- **Police chart** : licence libre (OFL) obligatoire, chargée localement
  (pas de CDN) ; à défaut, la typographie CSS (graisse/petites capitales) fait
  l'affaire pour P.1 — décision au checkpoint.
- **Le PDF de référence reste non versionné** (droits) ; le hook doc-only du
  repo le voit comme un changement non-doc — le laisser à la racine est
  toléré, ne jamais le committer.

## Veille liée (rappels de la roadmap v3)

- Modèle DAW du shell (`100dvh` + scroll interne) : candidat naturel au moment
  de P.3 quand le panneau devient la vue principale de lecture.
- Détection de structure (segmentation audio → sections pré-remplies) : ne pas
  coder spéculativement ; l'unroll de P.2 en est le prérequis, pas l'inverse.
