# Plan — Amélioration de la détection de tempo

> Statut (2026-07-06) : **Lot A ✅** (PR #66) · **Lot B ✅** — contrat enrichi pt.1
> (PR #67) + swap DSP `beat_this` pt.2 (branche `feat/tempo-beat-this-server`) ·
> **Lot C** à faire (tempo-map). Découpé en 3 lots, chacun = une branche + PR +
> `/session-report`.

## Problèmes à résoudre

1. **Erreur d'octave** — le tempo est parfois détecté ×2 (verrouillage à la
   croche quand les onsets de croches sont forts).
2. **Seulement 4/4** — `beatsPerBar` est plombé de bout en bout mais jamais
   transmis (`use-tempo.ts:51` appelle `detectTempo({ audio })`), donc 4/4 câblé.
3. **Changements de tempo** — le modèle stocke un `bpm: number` scalaire ; pas de
   support des ruptures de tempo en cours de morceau.

## Décisions arbitrées (2026-07-06)

- **Octave** → toggle **×2 / ÷2** manuel (escape hatch fiable, le musicien sait)
  + prior serveur amélioré.
- **Mesure** → **détection auto de downbeats** (pas seulement un sélecteur manuel).
- **Tempo variable** → **vraie tempo-map** (segments/BPM par beat).

## État actuel (carte)

- **DSP offloadé** à librosa côté serveur : `server/app/tempo.py:46-61`
  (onset-envelope → `librosa.beat.beat_track`, un scalaire bpm + instants).
  Guardé par le fallback 503 optionnel dans `server/app/main.py:103-113`.
- **Port** `packages/core/src/application/ports.ts:143-160` :
  `DetectedTempo { bpm, beatsSeconds }`.
- **Use-case** `packages/core/src/application/detect-tempo.ts` →
  `TempoAnalysis { bpm, grid }`.
- **Domaine** `packages/core/src/domain/tempo.ts:20-28` : `buildBeatGrid` marque
  un downbeat tous les `beatsPerBar` **en comptant depuis le beat 0** (fragile).
- **Web** : `use-tempo.ts`, `http-tempo-detector.ts`, `tempo-panel.tsx`
  (read-out `Math.round(bpm) BPM`), détection auto à l'import
  (`workstation-shell.tsx:201-220`) et à l'ouverture projet (`project-session.ts`).
- **Aval** : grille dessinée en lignes verticales sur la waveform ; stem
  métronome (`buildMetronomeStem`) ; persistence `ProjectTempo { bpm, grid, metronome? }`.
- **La grille est déjà basée sur des instants**, pas sur un BPM constant → déjà
  capable de variabilité ; ce sont le détecteur et la représentation du BPM qui
  ne le sont pas.

## Stack serveur (contraintes)

- `torch==2.12.1` + `torchaudio==2.11.0` **déjà présents** (Demucs) ;
  `librosa==0.11.0` ; numpy non pinné (transitif) ; **Python ≥ 3.11**.
- tempo = stack librosa **indépendant** de Demucs → évolue sans toucher au
  transport ni à la séparation. Le contrat/transport peut rester intact pendant
  qu'on remplace le DSP dans `_analyse`.
- Pas de Dockerfile ; venv + uvicorn, localhost, single-user, no auth.
- Poids téléchargés au premier appel (comme Demucs → `~/.cache/torch/hub`).

## Choix du moteur de downbeats

**Retenu : `beat_this`** (Foscarin et al., ISMIR 2024 — « Beat This! »). *Vérifié
✅ voir ci-dessous.*
PyTorch pur, **sans DBN/madmom**, sort beats **+ downbeats**, robuste aux
variations de tempo → couvre les problèmes **2 et 3** avec un seul moteur, dans le
torch déjà présent.

**Écarté : madmom / BeatNet** — reposent sur Cython + numpy ancien, ne compilent
pas proprement sur Python 3.11 + numpy moderne tiré par torch 2.12 (BeatNet
dépend de madmom en interne).

**Vérifications (2026-07-06) — feu vert :**
- [x] **Licence** : **MIT pour le code ET les poids** (README verbatim). Pas de
  souci copyleft (≠ Rubber Band GPL). Non bloquant.
- [x] **Dépendances** : `numpy>=1.20, torch>=2, torchaudio, einops,
  rotary-embedding-torch, soxr` ; `requires-python >=3`. **madmom optionnel**
  (uniquement `dbn=True`, qu'on n'utilise pas). S'installe proprement sur
  Python 3.11 + torch 2.12. `pip install beat-this` (v1.1.0, PyPI, avr. 2026).
- [x] **Taille** : `final0` (défaut) **≈ 78 Mo**, `small0` **≈ 8 Mo** si la
  latence CPU compte. Fetch auto au 1er appel depuis le cloud JKU vers
  `~/.cache/torch/hub/checkpoints` ; on peut passer un chemin local / pré-baker.
- [x] **API in-memory** : `Audio2Beats(checkpoint_path, device, dbn=False)
  (signal, sr)` → tuple `(beats, downbeats)` de np.ndarray en **secondes**.
  Prend un tensor en mémoire + sr → colle à notre `DecodedAudio` (pas de fichier).
- [x] **Sémantique** : downbeats renvoyés en **tableau séparé** ; gère tempo
  variable + mesures non-4/4 (c'est le but du papier, pas de DBN). **Pas de label
  de mesure explicite** → la mesure s'infère de l'espacement beats/downbeats.
- [x] **Maturité** : v1.1.0 (avr. 2026), maintenu, CPU supporté (plus lent →
  `small0` si besoin). CPJKU (mêmes auteurs que madmom). Fallback madmom **non
  nécessaire**.

> **Nuance contrat** : `beat_this` renvoie `(beats, downbeats)` — deux tableaux,
> pas une position par beat. Le mapping serveur vers `[{time, position}]` = pour
> chaque beat, `position = 1` s'il est dans l'ensemble des downbeats, sinon
> `(index depuis le dernier downbeat) + 1`. Trivial côté serveur, pur et testable.

## Le pivot : enrichir le contrat

Aujourd'hui : `POST /tempo → { bpm, beats: [secondes] }`.
Enrichi d'**une seule chose** — la position de chaque beat dans la mesure :

```
POST /tempo → { bpm, beats: [{ time: 0.51, position: 1 }, { time: 1.02, position: 2 }, …] }
```

`position === 1` = downbeat. Tout le reste se **dérive purement dans le core**
(testable, hexagonal, DSP reste au serveur) :

- **downbeats + mesure** = `position` (problème 2), mesure = `max(position)`
- **tempo variable** = `60 / (time[i+1] − time[i])` par beat, segmenté (problème 3)

Changement de port (greenfield, aucun consommateur externe) :

```ts
interface DetectedBeat {
  readonly timeSeconds: number
  readonly barPosition: number
}
interface DetectedTempo {
  readonly beats: readonly DetectedBeat[]
  readonly bpm: number // représentatif (médiane) — read-out rapide + rétro-compat
}
```

## Lots

### Lot A — Toggle ×2 / ÷2 (problème 1)
*D'abord : sans serveur, sans nouvelle dépendance, risque nul, valeur immédiate.*

- **Core (TDD)** : `foldOctave(tempo, 2 | 0.5)` pur — décime (1 beat sur 2) ou
  interpole (insère les milieux) + rescale bpm + re-dérive la grille.
- **Web** : boutons `[÷2] 128 BPM [×2]` dans `tempo-panel.tsx` ; re-seat
  métronome ; persister le facteur d'octave.

### Lot B — Contrat enrichi + downbeats auto (problème 2) — *linchpin*

- **Core (TDD)** : port `DetectedTempo` enrichi ; réécrire `buildBeatGrid` pour
  utiliser `barPosition` (robuste aux beats manquants, plus de comptage depuis le
  beat 0) ; dériver la mesure.
- **Serveur** : remplacer `_analyse` par `beat_this` (garder librosa en fallback
  503) ; mapper vers `[{time, position}]` ; **ajouter des tests serveur** (le DSP
  est actuellement non testé).
- **Web** : afficher la mesure détectée + override manuel optionnel ; adapter
  `foldOctave` (Lot A) à la nouvelle représentation.
- **Persistence** : stocker la mesure.

### Lot C — Tempo-map (problème 3)

- **Core (TDD)** : `TempoMap = readonly { fromSeconds; bpm }[]`, dérivé des
  intervalles + segmentation par détection de rupture (tolérance pour ne pas
  fragmenter sur le jitter).
- **Persistence** : `ProjectTempo.segments` (migration douce — anciens manifests
  sans segments continuent de charger).
- **Web** : read-out BPM = tempo **au playhead** + plage ; option d'une piste de
  tempo.

## Ordre & couplage

A → B → C. Seul couplage : `foldOctave` (A) opère sur la représentation du tempo ;
quand B enrichit les beats de `barPosition`, on adapte `foldOctave` (trivial). A
reste utile en l'état.
