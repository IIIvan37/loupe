# Plan — Détection de structure audio (Lot P phase 2 / Lot Q)

> Statut (2026-07-13) : **brouillon — validé sur le geste UI (bouton
> séparé), le spike S.0 attend un go explicite**. Déclencheur : la déduction
> MDL de P.4 phase 1 (tuilages uniformes sur les accords détectés) déçoit à
> l'usage — la structure est mal détectée. Direction retenue avec le produit :
> une **segmentation fonctionnelle depuis l'audio** (frontières + labels
> couplet/refrain), matérialisée en **marqueurs de structure** dans l'app et
> injectée dans le brouillon de grille.

## Le moteur — comparatif du 2026-07-13

Trois candidats sérieux instruits (all-in-one suggéré au départ, paysage
2024-2026 balayé ensuite) :

| | Qualité segments | Dépendances / torch 2.12 | CPU macOS | Licence |
|---|---|---|---|---|
| **1. SongFormer** (ASLP-lab, oct. 2025) | SOTA — bat all-in-one de ~7 pts ACC / ~10 pts HR.5F (SongFormBench-Harmonix) | Saine : ni NATTEN, ni madmom, **ni Demucs interne** ; torch épinglé 2.4 à desserrer, triton à retirer sur mac | Plausible (~700M params, pas de kernel custom) — **non vérifié, risque n°1 du spike** | Code+poids CC-BY-4.0 ; **teinte NC via le backbone MuQ** (CC-BY-NC) — même posture que nos poids htdemucs research-only |
| **2. all-in-one-fix** (fork maintenu de mir-aidj/all-in-one, nov. 2025) | Bonne (baseline MIREX) | NATTEN-free, torch 2.x libre ; **Demucs 4 stems interne** (cache pré-remplissable depuis nos stems 6s sommés) | Connu (Demucs domine, ~1-3 min) | MIT code + poids |
| 3. LinkSeg (ISMIR 2024) | Sous SongFormer | madmom via git (rouge), pas de LICENSE | Modèle léger | Non spécifiée |

Écartés : **all-in-one d'origine** (gelé oct. 2023, NATTEN à compiler,
incompatible torch ≥ 2.8), **SongPrep-7B** (LLM 7B CUDA-only, licence
academic-only), MSAF / sf_segmenter (frontières sans labels, morts).

- **Sorties SongFormer** : `{start, end, label}`, 8 labels (`intro, verse,
  chorus, bridge, inst, outro, silence, pre-chorus`). API Python propre
  (audio 24 kHz in → segments out), checkpoints HF (`snapshot_download`,
  revision-pinnable + md5 en repo ; sha256 à épingler nous-mêmes façon BTC).
- Les beats/BPM des moteurs sont **ignorés** : beat_this reste l'autorité
  tempo ; le léger désaccord frontières ↔ grille s'absorbe côté core.

## Ce qui existe déjà (carte)

- **Patron serveur complet** : `chords.py` = poids sha256-pinnés
  (`weights_cache.py`), sémaphore + `wait_for` + `abandon_on_cancel`,
  503 sans poids / 504 timeout, humble object hors du gate torch-free
  (stub 503 dans `main.py`). `/structure` suit ce moule à l'identique.
- **Patron core→web complet** : port `ChordDetector` → use-case
  `detectChords` → adapter `createHttpChordDetector` (`postWavForJson` +
  `classifyTransportError`) → hook `useChordDetection`. À décalquer.
- **Marqueurs** : `Marker { id, timeSeconds, label }` nu (pas de
  type/couleur), `MarkerList` pur, persistés dans le manifest projet,
  rail draggable + rename. Un marqueur de structure est un marqueur
  ordinaire étiqueté — **zéro changement de modèle** pour la v1.
- **La couture chart** : `deduceStructure(labels)` (chart-structure.ts)
  tuile uniformément faute de mieux — la phase 2 y injecte des **points de
  coupe réels** ; `renderStructuredSource` sait déjà rendre sections +
  reprises. `measureIndexAt(grid, seconds)` projette les frontières de
  segments sur les mesures.

## Décisions produit — à arbitrer avant de coder

1. **Marqueurs v1 = marqueurs ordinaires étiquetés** (« Couplet », «
   Refrain », traduits via Lingui), posés au début de chaque segment —
   aucun changement du domaine Marker. Un `kind` typé/coloré viendra si
   l'usage le réclame. *(recommandation)*
2. **Un seul geste ou deux ? — TRANCHÉ (2026-07-13) : bouton séparé.**
   « Détecter la structure » est indépendant (pose les marqueurs même sans
   grille d'accords) ; « Détecter les accords » se sert des sections quand
   elles existent.
3. **Teinte non-commerciale du backbone MuQ** : acceptable pour cet outil
   de pratique non commercial (posture déjà prise pour htdemucs), à
   documenter dans les Locked decisions. *(recommandation : accepter)*

## Les slices

### S.0 — Spike moteur — **FAIT (2026-07-13) : GO pour SongFormer + chunking**

Venv jetable Python 3.11 (`scratchpad/structure-spike`, uv), SongFormer +
MuQ-large + MusicFM montés, `msaf`/gradio contournés, device patché MPS,
pin torch 2.4 → **2.12.1 OK**. Testé sur 2 vrais morceaux.

**Résultats :**
- **MPS (GPU Mac) : ✅ tourne** (aucun op fatal, fallback STFT bénin).
- **Qualité : ✅ nettement au-dessus du MDL de P.4.** Logical Song
  (4:10) : `intro→couplet→couplet→refrain→…→solo(inst)→outro` exact au tag
  près. Queen Somebody To Love (5:10) : `intro/couplet/refrain/pont/solo/
  outro` riche et musicalement juste. Frontières sur de vraies sections.
- **Mémoire : ⚠️ le point dur.** L'inférence de référence fait une passe
  SSL **pleine fenêtre** (jusqu'à 420 s d'un coup) → **~16 Go de pic**,
  dépasse la RAM de ce Mac (16 Go) sur les morceaux > ~4,5 min → swap
  thrash (Queen jamais fini en pleine fenêtre).
- **Mitigation = chunking, validée + couture corrigée.** Algorithme final
  (prototype `chunked_infer.py`, à porter en TDD côté serveur) : chunks de
  `CHUNK_S` (180 s) avec **marges de contexte** `OVERLAP_S` (20 s) de chaque
  côté ; on ne garde que les segments dont le **centre** tombe dans la
  région possédée `[c·CHUNK, (c+1)·CHUNK]` — le biais « début de chunk = intro »
  reste dans la marge jetée ; puis fusion des contigus de même label +
  fermeture des trous → timeline contiguë. Résultat sur Queen : **RAM ~0,2 Go,
  RTF 0,17×**, seam de 180 s **invisible** (couplet l'enjambe proprement),
  plus d'intro parasite. Reste un « silence » en tête sur l'intro très
  clairsemée = jugement du modèle, pas un artefact, éditable dans le brouillon.

**Arbitrages produit pris :** découpage agressif + stitch retenu (vs moteur
plus léger) ; cible prod pas encore tranchée → **doit tenir sur ce Mac
16 Go**, donc chunking obligatoire dans l'intégration serveur (S.1).

**all-in-one-fix non testé** — inutile, SongFormer passe. Repli documenté
si besoin.

### S.1 — Serveur `POST /structure` *(TDD serveur)*

- Décalque de `chords.py` : upload WAV cappé, sémaphore
  (`LOUPE_MAX_CONCURRENT_STRUCTURE`), budget wall-clock, poids épinglés
  sha256 (`weights_cache.py`), 503 sans torch/poids, 504 timeout.
- Réponse : `{ segments: [{ start, end, label }] }` — beats/BPM du moteur
  jetés. Helper pur testé torch-free (validation/normalisation des
  segments : tri, chevauchements, labels inconnus → passthrough).
- `requirements-dev.txt` reste torch-free ; humble object exclu de
  coverage/pyright comme ses pairs.

### S.2 — Core : port + use-case *(TDD strict)*

- Port `StructureDetector.detect(audio, signal?) →
  DetectedSection[{ startSeconds, endSeconds, label }]` (miroir de
  `ChordDetector`).
- Use-case `detectStructure` : recale les frontières des segments sur les
  **downbeats** de la `BeatGrid`, garde les labels bruts (la traduction
  verse → Couplet vit côté web/Lingui). Sorties : (a) positions+labels
  pour les marqueurs, (b) points de coupe pour la grille.
- **Spec de snap — MESURÉ sur Queen le 2026-07-13 (beat_this vs SongFormer,
  `measure_snap.py`)** : les frontières SongFormer tombent déjà **quasi sur
  les downbeats** — écart médian **0,14 s** (< demi-mesure 0,81 s), 10/13
  frontières intérieures à ≤ 0,20 s. Le snap est donc un nettoyage de gigue,
  pas un rattrapage. Règles (= cas de test rouges) tirées des 3 exceptions,
  toutes des zones sans battue :
  1. snap au downbeat le plus proche **seulement si |Δ| < ~1 mesure** ;
     au-delà (anacrouse de tête, outro/fade sans downbeat — beat_this
     s'arrête à 289 s sur Queen) → **garder le temps brut** ;
  2. **1re frontière = 0** (ne pas snapper l'anacrouse vers le 1er downbeat) ;
  3. **dernière frontière = fin de piste** (ne pas la ramener au dernier
     downbeat détecté) ;
  4. deux frontières sur le même downbeat (section < 1 mesure) → fusion.
- **`deduceStructure` phase 2** : accepte des points de coupe externes —
  les sections détectées remplacent le tuilage uniforme ; le vote
  nettoyant par type de section est conservé (deux couplets votent
  toujours). Codes d'erreur typés bout-en-bout (patron N.1).

### S.3 — Web : adapter, hook, marqueurs, brouillon *(UI — checkpoint FAIT 2026-07-13)*

**Checkpoint d'approche tranché (2026-07-13) :**
- **Bouton « Détecter la structure » dans la BARRE DE REPÈRES** (à côté de
  « + Repère » / « Effacer ») — cohérent avec sa sortie (des marqueurs),
  visible sans ouvrir le panneau d'accords, indépendant de la grille.
- **La détection pose les marqueurs ET réétiquette la grille d'accords**
  quand elle existe : marqueurs de section + en-têtes `[Couplet]`/`[Refrain]`
  au lieu de `[A]`/`[B]` sur le brouillon.

Implémentation :
- `createHttpStructureDetector` (mix → WAV `POST /structure` → JSON
  `{segments}` → `DetectedSection[]`) + `useStructureDetection` (AbortSignal
  bout-en-bout, patron O.5 ; classifie les échecs transport en
  `StructureDetectionError`).
- Pose des marqueurs : un marqueur au début de chaque section, label traduit
  via Lingui (« Intro », « Couplet », « Refrain »… mapping label brut
  SongFormer → copie FR) ; confirmation deux temps « Remplacer les repères ? »
  si des marqueurs existent déjà (patron « armed work »).
- Réétiquetage grille : quand une grille existe, les sections détectées
  nomment ses en-têtes (`[Couplet]`…). Sous-slice possible S.3b si S.3a
  (marqueurs) suffit à valider l'usage d'abord.
- Marqueurs v1 = marqueurs ordinaires étiquetés (aucun changement du domaine
  `Marker`).

## Risques & garde-fous

- **CPU/MPS non vérifié pour SongFormer** — c'est LE risque, le spike
  commence là ; all-in-one-fix est la piste de repli vérifiée.
- **Desserrage du pin torch 2.4 → 2.12** : stack transformer standard,
  probablement OK, à prouver au spike. Tout écart de version torch imposé
  au venv partagé (Demucs/beat_this/BTC) est un no-go.
- **Désaccord segments ↔ grille** : les frontières ne tombent pas pile sur
  nos downbeats — l'arrondi à la mesure la plus proche est dans le core,
  testé en propriété (aucune section vide, la somme des sections couvre la
  grille).
- **Poids** : épingler sha256 façon BTC (le `md5sum.txt` du repo HF ne
  suffit pas) ; ~700M params ⇒ quelques GB — vérifier l'empreinte disque
  au spike.
