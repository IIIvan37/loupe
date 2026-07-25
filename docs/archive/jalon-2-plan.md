# Jalon 2 — Séparation IA (la tête d'affiche)

> **But.** La brique Moises, mieux ciblée : importer un morceau, le **séparer en
> N pistes adaptatives** (= les instruments réellement présents), les **mixer**
> (solo / mute / volume) et **exporter un dossier de stems aligné** prêt pour
> GarageBand / Logic / Ableton.
> *(Le regroupement en bus, initialement prévu, a été abandonné — voir Slices.)*
> Source : [docs/loupe-plan-produit.md](loupe-plan-produit.md) §4 (Jalon 2) et §3.3–3.7.

## Décisions verrouillées (kickoff)

- **Moteur de séparation : port abstrait `StemSeparator` dans le core pur, WASM
  client-side comme premier adapter.** Loupe **reste sans backend** ce jalon —
  l'audio ne quitte jamais la machine (argument local-first §3.1, juridique §3.10).
  Demucs WASM (ex. *freemusicdemixer*) en premier adapter ; l'**API cloud
  (LALAL / Moises)** restera un **second adapter** branché plus tard sur le même
  port, sans toucher au domaine.
- **Première slice = séparer le morceau déjà chargé → pistes**, câblé d'abord sur
  un séparateur **stub** (stems factices derrière le port) — UI-first. On dérisque
  le flux UX et le contrat du port avant de payer le coût du vrai moteur WASM.
  **Pas de second import** : l'entrée de la séparation est le **même `DecodedAudio`
  que le lecteur Jalon 1** (on ne re-décode pas) — l'import (J1) retient le PCM
  décodé pour le re-fournir au séparateur.
- **Découpe : N pistes adaptatives** (plan produit §3.4). Pas de profil fixe
  « toujours 6 pistes » : on masque les pistes dont l'énergie est négligeable,
  chacune affichée avec sa confiance. *(Le regroupement utilisateur §3.5 est
  abandonné — voir Slices.)*
- **Export : palier A** (plan produit §3.7) — dossier de stems WAV alignés (t=0,
  même durée, nommés), zippé + tempo en métadonnée. Palier B (`.band`) = hors jalon.

### Licence du modèle (verrouillé Slice J2.2)

Le moteur réel (J2.2) est **htdemucs**, derrière le port `StemSeparator`, avec
**deux adapters** sélectionnables (`createSeparator`) : par défaut **demucs.cpp
compilé en WASM** (`Retrobear/demucs.cpp`, fp16 ~84 Mo, mono-thread SIMD, plus
léger/rapide, pas d'upcast fp32) ; alternative **onnxruntime-web** (`StemSplitio/
htdemucs-onnx`, fp16 ~166 Mo). Le `demucs.cpp` n'a pas de build npm → compilé via
`packages/web/scripts/build-demucs.sh` (Docker emsdk 3.1.51), artefacts
`public/demucs/demucs.{js,wasm}` commités. Le **code** (onnxruntime-web, demucs.cpp,
demucs) est MIT, mais **les poids htdemucs sont research-only** : entraînés sur
MUSDB18 (non-commercial), l'auteur Demucs déclare
qu'ils sont « provided only for scientific purposes »
([facebookresearch/demucs#327](https://github.com/facebookresearch/demucs/issues/327)).
Les tags « MIT » des ré-exports ONNX sont des relabels inexacts. **Décision** :
loupe étant un outil **public, non-commercial**, cet usage scientifique est
acceptable — mais **ne pas embarquer ces poids dans un produit commercial** (il
faudrait alors des poids sous licence commerciale ou ré-entraînés). Même esprit que
la bascule Rubber Band (GPL) → SoundTouch. Mono-thread ⇒ pas de SharedArrayBuffer ⇒
**aucun en-tête COOP/COEP** ⇒ déploiement **Netlify** sans config.

## Architecture — produit → hexagone

On prolonge l'hexagone de Jalon 1. Le **temps réel reste local** ; la séparation
(lourde) passe derrière un port, exactement comme la lecture passe par
`PlaybackEngine`. Le core ne sait **rien** de WASM ni d'une API — il manipule des
valeurs (échantillons, confiances, gains) et appelle un port.

| Couche | Contenu | Pureté |
|---|---|---|
| **`@app/core`** | Domaine séparation/mixer (modèles + math) + use-cases + **ports**. Zéro WASM/DOM/Web Audio. | Pur — TDD + property + mutation (Stryker) |
| **`packages/web`** → composants **smart** | Câblent les use-cases + ports + état Jotai. = adapters. | Impur — tests intégration |
| **`packages/web`** → composants **dumb** | Vue pure *props → JSX*. | impeccable + tests composant |

**Domaine pur identifié.**
- `SeparationState` (reducer : `idle → analysing → separating → ready | error`,
  progression 0–1, annulable).
- `StemSet` / `StemTrack` (id, label instrument, échantillons/peaks, confiance).
- `InstrumentDetection` — à partir d'énergies par piste, décide **quelles pistes
  garder** (seuil de masquage) et leur **confiance** ; produit la liste adaptative.
- `MixerState` (reducer) — par piste : gain, solo, mute → calcul des **gains
  effectifs** (un solo coupe les autres ; mute = 0). Property-testé.
- Encodage **WAV PCM** (échantillons → octets) : pur, valeurs → valeurs.
- Nommage/alignement d'export (`01_Voix.wav`…, t=0, même durée) : pur.

> *`TrackGroup` / bus utilisateur (regroupement) : abandonné — voir Slices.*

**Ports (driven, implémentés côté web).**
- `StemSeparator.separate(audio, onProgress) → StemSet` — adapter **stub** (S1)
  puis **WASM** (S2) ; API cloud = adapter futur.
- `StemPlaybackEngine` — graphe Web Audio multipiste (un nœud de gain par stem +
  sortie master), étend / réutilise l'esprit de `PlaybackEngine` de Jalon 1.
- `ArchiveWriter.write(files) → blob` + déclenchement du download (zip côté web).

## Boucle de travail par slice

Identique à Jalon 1 (chaque slice = tranche hexagonale verticale, sa branche, son PR) :

1. `/new-feature-hexa` — outside-in : test d'acceptation du use-case d'abord.
2. `/tdd-cycle` — red → green → refactor sur tout le core ; property-tests (fast-check).
3. `pnpm gate` — gate bloquante (+ `check:design` + `check:react`).
4. `pnpm test:mutation` — Stryker scoped `@app/core`, avant le PR.
5. **`/code-review`** — revue de la diff de la slice.
6. `/session-report` — met à jour `docs/STATUS.md` + rapport daté ; ship **dans** le PR.

## Slices

| # | Slice | Domaine pur (core) | Adapter (web) |
|---|---|---|---|
| **1** | **Séparer le morceau chargé → pistes** *(UI-first, séparateur stub)* | `SeparationState` (reducer), `StemSet`/`StemTrack`, port `StemSeparator` | `StubSeparator` (stems factices + progression), action « Séparer » sur l'audio déjà importé (pas de second import), états *analyse / séparation / prêt*, liste de pistes |
| **2** | **Moteur WASM réel** derrière le port | (contrat `StemSeparator` déjà posé) | adapter **Demucs WASM** dans un worker (off-main-thread), progression réelle, gestion mémoire/erreurs |
| **3** | **Détection → N pistes adaptatives** | `InstrumentDetection` (énergies → garder/masquer + confiance) | masquage des pistes vides, ligne « non détectés », badge confiance (cyan = détecté machine) |
| **4** | **Mixer multipiste** solo / mute / volume | `MixerState` (gains effectifs, property-testé) | `StemPlaybackEngine` (graphe gains), faders, waveform qui pâlit selon le niveau |
| ~~**5**~~ | ~~**Regroupement de pistes** (bus utilisateur)~~ — **abandonné (2026-06-30)** : peu de valeur perçue | — | — |
| **6** | **Export — palier A** (dossier de stems aligné) | encodage WAV PCM, nommage/alignement | `ArchiveWriter` (zip + download) |

> Ordre dérisquant : on câble le flux complet sur un **stub** (S1), on remplace par
> le **vrai moteur** une fois le contrat figé (S2), puis on enrichit
> (adaptatif → mixer → export). Chaque slice est livrable seule.

## Tokens de design (rappel — règle sémantique)

**Ambre = tes réglages / ce qui joue ; cyan/teal = ce que la machine a détecté.**
La confiance par piste et les instruments détectés s'affichent en **teal**
(`--teal:#56B8C9`) ; faders et niveaux actifs en **ambre**. Couleurs de stems
réservées (plan produit / spec) : voix `#E2897A` · batterie `#7C86A6` · basse
`#A481C9` · guitare `#8DB585` · claviers `#6FA8D4`. Données chiffrées (confiance %,
gains dB, durées) en **IBM Plex Mono**.

## Hors Jalon 2

- **API cloud de séparation** — second adapter du même port, branché plus tard
  (quand le volume ou la qualité le justifient) ; n'impacte pas le domaine.
- Analyse réelle tonalité / BPM / accords / métronome intelligent → **Jalon 3**.
- Export MIDI, pédales, vidéo, séparation auto-hébergée GPU → **Jalon 4**.
- Partition notation + tablature (AlphaTab) → **Jalon 5**.
- Bundle GarageBand `.band` (palier B), comptes / quotas / abonnement.
