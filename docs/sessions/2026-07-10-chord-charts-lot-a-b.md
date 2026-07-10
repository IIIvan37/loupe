# Session — 2026-07-10 — grilles d'accords (Lot A/B — lead-sheet)

Branche `feat/chord-chart-model` (off `main`). Premier slice du plan
[chord-charts-plan.md](../chord-charts-plan.md), gelé la même journée.

## Done
- **Étude + plan gelés** (doc-only, déjà sur `main`) : plan de faisabilité
  découpé en deux couches (rendu/édition vs extraction ACE), **3 décisions
  produit arbitrées** (vue lead-sheet ; vocabulaire triades pop/rock comme
  socle ; format grille maison + rendu maison, ZÉRO lib) et **moteur ACE
  arbitré par deep-research** (BTC MIT/PyTorch ; Chordino/Vamp écartés GPL +
  install fragile ; essentia.js écarté AGPL).
- **Lot A — core pur (TDD strict, outside-in)** :
  - [chord-symbol.ts](../../packages/core/src/domain/chord-symbol.ts) :
    `parseChordSymbol('Cmaj7/E' → {root,quality,bass})` (racine + altération,
    qualité opaque = vocabulaire ouvert, basse slash), `formatChordSymbol`
    (l'inverse, **invariant round-trip** `format ∘ parse` prouvé fast-check),
    `transposeChordSymbol` (arithmétique de classes de hauteur, spelling en
    dièses, basse transposée ; **invariants** transpose-0 et transpose-octave =
    identité via garde `%12===0` pour ne pas re-speller `Db`→`C#`).
  - [chord-chart.ts](../../packages/core/src/domain/chord-chart.ts) : modèle
    `ChordChart`/`Section`/`Measure` + `parseChart` (format grille maison :
    en-tête `[Section]`, rangées de mesures `|`, accords espacés dans une
    cellule, lignes vides ignorées).
- **Lot B (minimal) — web** :
  - [lead-sheet.tsx](../../packages/web/src/app/lead-sheet/lead-sheet.tsx) :
    rendu lead-sheet en **HTML + CSS Grid maison**, zéro lib ; clés
    positionnelles calculées hors JSX (view-model keyed).
  - [chord-chart-panel.tsx](../../packages/web/src/app/lead-sheet/chord-chart-panel.tsx) :
    **saisie manuelle** (textarea) → rendu live ; état source en local
    (persistance différée). Câblé dans
    [shell-main.tsx](../../packages/web/src/app/workstation-shell/shell-main.tsx)
    (gated `isLoaded`). 3 ids Lingui (`chords.title/input-label/placeholder`),
    extraits.
- **Boucle outside-in réalignée** (feedback utilisateur en cours de session :
  le premier jet était bottom-up) : acceptance web ROUGE → a tiré `parseChart`
  → réutilise `chord-symbol`. `LeadSheet` a un vrai foyer (le panneau, monté
  dans le shell) — l'orphelin `deslop/unused-file` de react-doctor a servi de
  garde-fou côté web, exactement comme knip côté core.

## Not done / remaining
- **Persistance `ProjectChordChart`** : l'état de la grille vit en local dans
  `ChordChartPanel` ; à signer dans le manifest (comme `ProjectTempo`).
- **`transposeChordSymbol` non exporté** de `index.ts` (aucun consommateur) —
  la transposition UI viendra le tirer ; `transposeChart` (chart entier) reste
  à écrire à ce moment-là.
- **Rendu lead-sheet minimal** : pas encore de bars-per-row configurable, ni
  d'alignement `BeatGrid` (surlignage mesure courante), ni de style print/PDF
  soigné. Ce sont les incréments Lot B suivants.
- ~~**Vérif navigateur** différée au Mac~~ → **faite à la reprise
  (2026-07-10, Chrome réel)** et elle a payé : les mesures s'affichaient en
  bandes claires au texte invisible — le CSS pointait des tokens inexistants
  (`--border` retombant sur `currentColor` en fond de rangée, `--surface`).
  Corrigé sur les vrais tokens (`--line`/`--panel-2`/`--text`/`--dim` +
  échelle d'espacement) et le textarea composé depuis l'input de
  `popover-form` (`composes` cross-file, jscpd stable à 7). Rendu re-vérifié :
  sections, barres de mesure, `Dm/F`, saisie → rendu live.
- **Rangée incomplète** : la grille est figée à 4 colonnes, une rangée de 3
  mesures montre une cellule vide en bout — à traiter avec le bars-per-row
  configurable (incrément Lot B).
- **Lot C (ACE serveur)** : non commencé ; pré-requis = spike Demucs + dispo
  poids ChordFormer (angles morts du plan).

## Decisions
- **Format & rendu maison, zéro lib** : ni ChordSheetJS (GPL-2.0 + modèle
  accords-sur-paroles ≠ grille de mesures) ni Essentia (AGPL). Parser
  line-oriented + rendu CSS Grid, tous deux triviaux et sous contrôle. ChordPro
  reste une inspiration de syntaxe + interop optionnelle (Lot D), jamais une
  dépendance.
- **Le temps est une projection, pas un champ** : le modèle est indexé en
  mesures, sans secondes ; le surlignage « mesure courante » se dérivera de la
  `BeatGrid` au rendu. La lead-sheet reste valide/imprimable sans beat grid.
- **Qualité d'accord opaque** : `quality` est une string préservée verbatim
  (round-trip lossless, vocabulaire ouvert) ; seuls racine et basse sont
  interprétés (pour transposer).
- **`transpose(x, 12k) = identité exacte`** (garde `%12===0`) : un déplacement
  d'octaves entières ne doit pas re-speller (`Db` reste `Db`), et transpose-0
  est l'identité.
- **`renderChordSymbol` → `formatChordSymbol`** : renommé pour lever un faux
  positif react-doctor (`no-render-in-render`) — la fonction renvoie une string,
  pas un composant ; « format » est aussi le nom juste.

## Gate status
- typecheck: ✅
- tests (with coverage): ✅ **798 passed** (79 files ; +19 cette session) —
  coverage **96,04 % stmts / 88,83 % branches** (seuils 85/80)
- mutation (Stryker, local — core touché): ✅ **fait à la reprise sur le Mac
  (2026-07-10, après rebase sur le count-in)** — global **94,52 %** ; le
  premier run a montré **7 survivants réels** sur les fichiers chord (note
  inconnue → `undefined` à la transposition, clé `bass` fantôme — attrapée au
  `toStrictEqual`, accord vide sur double espace, section vide sur lignes
  blanches de tête, ancres du header `[Section]`, header indenté), tous tués
  par des pins de contrat ciblés → `chord-symbol.ts` et `chord-chart.ts`
  **100 %** (0 survivant, run scopé `--force`).
- biome / sheriff / knip / jscpd: ✅ / ✅ / ✅ / ✅ ; impeccable + react-doctor ✅

## State to resume from
- **Single next action** : ~~ouvrir la PR~~ (faite à la reprise : rebase sur
  `main` post-count-in, Stryker 100 % sur les fichiers chord, vérif navigateur
  + fix tokens), puis enchaîner sur **la persistance `ProjectChordChart`**
  (signer la grille dans le manifest, restaurer à l'ouverture) OU **la
  transposition UI** (qui tirera `transposeChordSymbol` + un nouveau
  `transposeChart`).
- Gotchas :
  - `ChordChartPanel` est **auto-contenu** (état local `useState`) — dès qu'on
    ajoute la persistance, lever l'état vers un hook (comme `useTempo`) et
    passer la source en props.
  - `formatChordSymbol` (pas `renderChordSymbol`) est le nom exporté ;
    `transposeChordSymbol` est écrit + testé mais **non exporté** de
    `index.ts` (le rebrancher au moment de la transposition UI).
  - Le format grille : `parseChart` ignore les lignes vides et traite tout ce
    qui précède un `[Section]` comme une section sans label ; `formatChordSymbol`
    ne re-spelle jamais (pas d'inverse de la table dièse↔bémol).
  - `LeadSheet` calcule ses clés hors JSX (`keyed()`) — garder ce patron si on
    l'étend, sinon SonarLint `S6479` (clés par index) revient.
