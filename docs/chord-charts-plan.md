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

## Choix du moteur ACE — arbitré par recherche approfondie (2026-07-10)

> Deep-research (108 agents, 25 sources primaires, 25 affirmations vérifiées 3-0,
> 0 réfutée). **Conclusion qui corrige l'intuition initiale de ce plan** : Chordino
> n'est *pas* la bonne « option robuste simple » — c'est un piège licence + install.
> Les bons candidats sont **deep, PyTorch, MIT**, donc alignés pile sur notre stack.

| Besoin | Outil | Licence | Stack / vocab | Verdict |
|---|---|---|---|---|
| **Robuste, intégration rapide** | **BTC** (`jayg996/BTC-ISMIR19`) | **MIT** | PyTorch, poids fournis, flag `voca` (25 maj-min / 170 accords) ; WCSR maj-min ~83,8 root / 82,7 | ✅ **Tier 1 retenu** |
| **Précision / grand vocab (jazz)** | **ISMIR2019 music-x-lab** (Chord Structure Decomposition) | **MIT** | PyTorch, poids inclus, dicts ~170–301 classes (7ths/inversions/étendus) | ✅ **Tier 2** |
| SOTA récent grand-vocab | ChordFormer (arXiv 2502.11840, 02/2026) | ⚠️ code/poids non confirmés | Conformer, 301 classes, MIREX 83,6 % — mais class-wise 0,39 | 🔬 à surveiller |
| ~~« robuste classique »~~ | ~~Chordino / NNLS-Chroma~~ | 🚩 **GPL-2.0** | runtime Vamp natif + bindings `vamp` figées 2015 (wheels cp27, build from-source Py 3.11) ; non beat-sync | ❌ **écarter** |
| wrapper Python de Chordino | chord-extractor | 🚩 **GPL-2.0** | hérite Vamp + copyleft | ❌ écarter |
| lib « clé en main » | autochord | — | 🚩 **TensorFlow** (à côté de torch) + Vamp, **25 classes** | ❌ écarter |
| baseline deep | madmom | BSD | 🚩 **maj-min only** (25 classes) + risque install Cython/numpy sur 3.11 | ⚠️ insuffisant |
| beat-sync natif | Essentia `ChordsDetectionBeats` | 🚩 **AGPL** | seul à sortir 1 accord/beat nativement, mais copyleft fort | ⚠️ licence |

**Décisions actées :**
- **Moteur retenu : BTC (MIT, PyTorch)** en `voca=False` pour des triades pop/rock
  fiables ; option `voca=True` (170 accords) ou bascule vers **ISMIR2019 music-x-lab**
  si le besoin jazz/étendu se confirme. Nouvel endpoint `/chords` + port
  `ChordDetector`, mirroring `TempoDetector`/`StemSeparator`.
- **WASM abandonné** : `essentia.js` beat-sync est séduisant mais **AGPL** (copyleft
  fort) + le précédent WASM (demucs.cpp/onnxruntime) déjà retiré pour un mur
  qualité/vitesse. On reste serveur.
- **Aucun moteur n'est nativement beat-synchronous** (sauf Essentia, écarté). BTC &
  co sortent des **labels horodatés** → l'agrégation « 1 accord/mesure » sur la
  `BeatGrid` beat_this (**vote majoritaire de frames, changement contraint sur
  downbeat**) est du **travail d'intégration côté loupe**, pas une capacité fournie.
  Bonne nouvelle : c'est du pur, testable dans le core.

**Deux angles morts à lever avant le Lot C (non résolus par la recherche) :**
1. **Gain réel de la pré-séparation Demucs** (ACE sur mix harmonique sans voix/
   batterie) : plausible et souvent constaté, mais **quantifié par aucune source** →
   à mesurer sur nos propres pistes, pas un acquis.
2. **Dispo effective de ChordFormer** (code + poids sous licence permissive,
   exécutable Py 3.11 CPU) : seul le papier est confirmé pour l'instant.

> Réserve de fond : les scores (BTC/ISMIR2019/ChordFormer) sont **auto-reportés** sur
> des splits non identiques → non strictement comparables ; la précision class-wise
> grand-vocabulaire reste faible (0,39) → **les accords rares/étendus resteront
> bruités**, l'édition manuelle (Lot A) n'est pas optionnelle mais le filet assumé.

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
*Pré-requis : lever les deux angles morts (§ moteur ACE) — spike Demucs et dispo
poids — avant de s'engager.*
- **Serveur** : endpoint `/chords` avec **BTC** (MIT, PyTorch — poids fournis,
  `voca=False` d'abord) sur mix pré-séparé Demucs (à valider), fallback 503,
  **tests serveur**. Sortie = labels d'accords **horodatés** (pas beat-sync).
- **Core (TDD)** : port `ChordDetector`, use-case `detectChords(audio, grid) →
  ChordChart`. **L'agrégation « labels horodatés → 1 accord/mesure »** (vote
  majoritaire de frames pondéré par durée, changement contraint sur downbeat) est
  une **fonction pure du core**, testable — c'est là que vit l'alignement beat-sync
  que le moteur ne fournit pas.
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
  constaté sur la séparation ; `essentia.js` en prime est **AGPL**).
- **Drapeau licence** : toute la famille Chordino/Vamp (chord-extractor inclus) est
  **GPL-2.0**, Essentia **AGPL** — copyleft déclenché à la distribution. Le
  self-hosted single-user atténue mais reste un drapeau ; on privilégie **MIT/BTC**.
- **Précision grand-vocabulaire faible** (class-wise ~0,39) : les accords jazz/
  étendus resteront bruités quel que soit le moteur → l'édition manuelle (Lot A)
  est le contrat, pas un rattrapage.
