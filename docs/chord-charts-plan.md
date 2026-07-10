# Plan — Grilles d'accords à partir d'un morceau

> Statut (2026-07-10) : **ÉTUDE DE FAISABILITÉ** — aucun code. **Décision #1
> arbitrée : la vue cible est une _lead-sheet_** (grille mesures/lignes orientée
> page, façon [chordsheet.com](https://www.chordsheet.com/) : langage texte
> spécialisé → grille de mesures, bars-per-row configurable, sections). La valeur
> ajoutée de loupe par-dessus chordsheet.com : la lead-sheet est **synchronisée à
> la lecture** — la mesure courante se surligne pendant que le morceau tourne,
> grâce au `BeatGrid`. L'overlay accords-sur-waveform devient un **secondaire
> optionnel**, pas le cœur.

## Le découpage qui décide de tout

Le sujet cache **deux couches de difficulté très inégale**. Les confondre, c'est
se lier les mains à la partie risquée avant d'avoir livré la partie facile.

1. **Couche RENDU/ÉDITION — DSL texte → grille.** C'est *tout* ce que fait
   chordsheet.com : plain-text → grille bars/mesures (Nashville, transposition,
   DaCapo, diagrammes). Problème **résolu**, écosystème mature. Faisabilité **haute**,
   risque **bas**, 100 % dans le core pur (parser) + un overlay web.
2. **Couche EXTRACTION — audio → accords (ACE).** *Automatic Chord Estimation*,
   un problème MIR **ouvert**. État de l'art honnête : ~80–90 % sur majeur/mineur
   en pop/rock, chute franche sur 7th/extensions/inversions/jazz. Faisabilité
   **conditionnelle** (qualité + où tourne le calcul).

**Principe directeur** (outside-in + domain-first) : livrer la couche 1 avec
**saisie manuelle** d'abord — valeur immédiate, zéro risque MIR — puis brancher
l'ACE comme un adapter qui **pré-remplit un brouillon** que l'utilisateur corrige.
La qualité imparfaite de l'extraction est ainsi **absorbée par l'édition**, pas
exposée crue.

## Ce qui existe déjà (carte) — loupe part avec une longueur d'avance

Presque toute l'infra dure est là ; le coût marginal se réduit au modèle
domaine + l'overlay + l'endpoint ACE.

- **PCM réutilisable.** `loadTrack` (`packages/core/src/application/load-track.ts`)
  décode une fois et **retourne le `DecodedAudio`** (`{ sampleRate, channels }`,
  `packages/core/src/application/ports.ts`) pour que l'aval ne re-décode pas —
  même mécanisme que `TempoDetector`/`StemSeparator`. Une analyse d'accords
  suivrait ce patron : PCM passé *dans* le core via un port.
- **Beat grid phase-anchored avec downbeats.** `packages/core/src/domain/tempo.ts` :
  `BeatGrid = Beat[]` (`{ timeSeconds, downbeat }`), `detectMeter`, et le manuel
  Lot I.2 `ManualTempo { bpm, phaseSeconds }` + `buildManualGrid`. **Chaque mesure
  = 1 downbeat** → l'alignement temporel accord↔waveform est quasi gratuit. Atout
  rare : les éditeurs de charts classiques n'ont aucune notion de temps réel.
- **Overlay timeline fraction-based avec précédent.** `ZoomStage`
  (`packages/web/src/app/waveform/zoom-stage.tsx`) : toute couche alignée se place
  en `left: ratio*100%`. La **beat grid est déjà dessinée ainsi**
  (`packages/web/src/app/waveform/waveform-view.tsx` ~L265). Un overlay d'accords
  suit exactement cet idiome ; mapping pointeur→ratio via `lib/pointer-ratio.ts`.
- **Persistance par projet.** `ProjectTempo` est signé dans le manifest
  (`packages/core/src/domain/project.ts`). Un `ProjectChordChart` s'y ajoute pareil.
- **Patron serveur→port rodé.** FastAPI localhost (`server/app/`) sert déjà Demucs
  (`/separate`) et beat_this (`/tempo`), imports paresseux + fallback 503. Un
  `/chords` + port `ChordDetector` **mirroring `TempoDetector`** est le chemin
  naturel — et l'ACE profite énormément des **stems Demucs déjà disponibles**
  (isoler l'harmonique, retirer voix/batterie).
- **Marqueurs & régions** (`domain/marker.ts`, `domain/loop-region.ts`) montrent le
  patron d'état temporel pur persisté dans le projet — modèle de référence pour la
  structure de sections.

## Décisions produit à arbitrer (bloquantes avant les lots)

1. ~~**Quelle(s) vue(s) ?**~~ **✅ Arbitré : lead-sheet.** La grille mesures/lignes
   orientée page (façon chordsheet.com) est **le** rendu cœur : bars-per-row
   configurable, sections nommées, pensée pour l'écran *et* l'impression/PDF.
   L'overlay accords-sur-waveform (`ZoomStage`) reste possible en secondaire mais
   n'est pas prioritaire. Conséquence archi : le modèle domaine se dérive de la
   **structure musicale** (sections → mesures → accords), pas de la timeline ; le
   temps (surlignage de la mesure jouée) est une **projection** de la lead-sheet
   sur le `BeatGrid`, dérivée, non stockée.
2. **Quel vocabulaire d'accords ?** Triades pop/rock (ACE fiable) vs
   extensions/jazz (ACE décevant → édition manuelle quasi obligatoire). Détermine
   le réalisme de la promesse « automatique » et la richesse du DSL.
3. **Quel DSL ?** Réutiliser un format existant (**ChordPro** via ChordSheetJS,
   ou l'idiome **iReal Pro**/Nashville) vs un mini-DSL maison minimal. Un format
   établi = interop/export gratuits ; un DSL maison = parser plus simple, calé sur
   nos mesures. *Penchant : mini-DSL maison orienté mesures pour le core, avec
   export ChordPro plus tard si besoin.*

## Le modèle domaine (esquisse, à confirmer par les tests)

Consumer-driven : le besoin « afficher/éditer une grille calée sur les mesures »
tire le modèle. Ordre de grandeur :

```
ChordSymbol   { root, quality, bass? }         // Cmaj7/E — parsé & re-rendu, pas une string libre
Measure       { chords: ChordSymbol[] }         // 1..n accords dans la mesure (beats implicites)
Section       { label?, measures: Measure[] }   // Intro / Couplet / Refrain …
ChordChart    { sections: Section[], meta }     // le document complet
```

- **Structure musicale d'abord.** Le modèle est indexé en **mesures**, pas en
  secondes — la lead-sheet est un rendu de `sections → measures → chords`, sans
  aucune donnée temporelle. C'est ce qui la rend imprimable/exportable telle quelle.
- **Le temps est une projection, pas un champ.** Pour le surlignage « mesure
  courante », on **mappe** la i-ᵉ mesure de la lead-sheet sur le i-ᵉ intervalle
  downbeat→downbeat du `BeatGrid` (source unique, comme la tempo-map non persistée).
  Dérivé, jamais stocké → robuste au ré-calage de phase, et une lead-sheet reste
  valide même sans beat grid (le surlignage se désactive, c'est tout).
- **Parser DSL** : `parseChart(text) → ChordChart` pur, TDD + fast-check pour les
  invariants (round-trip `render(parse(x)) === normalize(x)`, mesures ≤ meter, etc.).
- **Transposition** : `transpose(chart, semitones)` pur — trivial une fois les
  accords parsés, pas des strings.

## Choix du moteur ACE (à vérifier comme beat_this l'a été)

Deux chemins, avec un **précédent défavorable au WASM** :

- **In-browser WASM** — `essentia.js` (chromagram/HPCP/key). ⚠️ Le README serveur
  note que le WASM (demucs.cpp GGML / onnxruntime-web) a été **essayé et retiré**
  pour un mur qualité/vitesse. À ne reprendre que si l'on veut absolument éviter
  le serveur.
- **Serveur (voie établie) — recommandé.** Nouvel endpoint `/chords` + port
  `ChordDetector`. Candidats à instruire :
  - **Chordino / NNLS-Chroma** (Vamp) — robuste, triades + 7ths, éprouvé ; le
    classique de l'ACE. Bon rapport qualité/simplicité.
  - **Modèles deep (BTC, ou dérivés)** — vocabulaire plus riche, plus lourd/variable.
  - **Pré-traitement décisif** : passer l'ACE sur un **mix harmonique** (stems
    Demucs sans voix ni batterie) améliore nettement la détection. On a déjà Demucs.
  - **Alignement** : forcer un accord par **beat/mesure** en s'appuyant sur le
    `BeatGrid` (beat-synchronous chroma) → sortie propre, lissée, directement
    mappable sur `Measure`.

> À vérifier avant de retenir (grille beat_this) : licence, deps sur Python 3.11 +
> torch déjà présent, taille des poids, API in-memory prenant un tensor + sr (coller
> à `DecodedAudio`, pas de fichier), maturité/maintenance, CPU supporté.

## Lots (ordonnés outside-in — la valeur d'abord, l'IA en dernier)

### Lot A — Modèle `ChordChart` + DSL + **saisie manuelle** — *sans aucune IA*
*D'abord : pur core, risque nul, valeur immédiate (annoter une grille à la main
calée sur la beat grid existante).*

- **Core (TDD)** : `ChordSymbol`/`Measure`/`Section`/`ChordChart`, `parseChart`,
  `render`, `transpose` ; property tests round-trip.
- **Web** : saisie/édition d'accords par mesure, ancrés aux downbeats du `BeatGrid`.
- **Persistence** : `ProjectChordChart` signé dans le manifest.

### Lot B — Rendu lead-sheet (grille mesures/lignes) — *la vue cœur*
- **Web** : composant lead-sheet — sections nommées, mesures disposées en lignes
  (**bars-per-row** configurable), accords re-rendus depuis `ChordSymbol`.
  CSS grid, pensé écran **et** impression/PDF (média print). Pas de dépendance à la
  waveform : la lead-sheet se suffit à elle-même.
- **Sync lecture (dérivée)** : surligner la mesure courante en projetant l'index de
  mesure sur le `BeatGrid` (voir modèle) — se désactive proprement sans beat grid.
- **Secondaire optionnel** : overlay accords sur `ZoomStage` (même idiome que la
  beat grid), à faire seulement si le besoin timeline émerge.

### Lot C — Extraction ACE (serveur) → brouillon éditable — *linchpin risqué*
- **Serveur** : endpoint `/chords` (moteur retenu + pré-sépa harmonique Demucs,
  chroma beat-synchronous), fallback 503, **tests serveur**.
- **Core (TDD)** : port `ChordDetector`, use-case `detectChords(audio, grid) →
  ChordChart` (accords alignés sur les mesures).
- **Web** : bouton « Détecter les accords » → **pré-remplit** un brouillon que
  l'utilisateur corrige via l'éditeur du Lot A.

### Lot D (optionnel) — Export / interop
- Export ChordPro / PDF (façon chordsheet.com) ; import de charts existants.

## Ordre & couplage

A → B → C → (D). A et B ne dépendent **pas** de l'audio ni du serveur : ils livrent
un éditeur de grilles calé sur les mesures, utile seul. C se branche derrière sans
rien casser (le port ne fait que produire un `ChordChart` que l'éditeur consomme
déjà). Seul couplage réel : l'alignement mesure↔downbeat, qui repose sur le
`BeatGrid` **déjà** en place (détecté via beat_this ou saisi en tempo manuel).

## Risques & réalité

- **Précision ACE** : acceptable pour triades pop/rock, décevante sur jazz. Le
  choix de vocabulaire (décision #2) fixe la promesse ; l'édition manuelle est le
  filet, pas une option.
- **Piège de la vue page** : même si la lead-sheet est la vue cœur, dériver le
  modèle de la **structure musicale** (sections → mesures → accords), pas de la
  mise en page (bars-per-row, sauts de ligne) — la disposition est un paramètre de
  rendu, jamais un champ du modèle. Sinon transposition/sync/export se compliquent.
- **Ne pas repartir sur le WASM** sans raison forte (mur qualité/vitesse déjà
  constaté sur la séparation).
