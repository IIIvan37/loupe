# Jalon 1 — Le lecteur de transcription (« Transcribe! dans le navigateur »)

> **But.** Un lecteur de transcription musicale 100 % client, sans backend.
> Livrable et utile seul, sans aucune IA. Fondation de tous les jalons suivants.
> Source : [docs/loupe-plan-produit.md](loupe-plan-produit.md) §4 et
> [docs/loupe-spec/CLAUDE.md](loupe-spec/CLAUDE.md).

## Décisions verrouillées (kickoff)

- **Moteur de time-stretch : Rubber Band.** ⚠️ Implique que le produit soit publié
  sous **GPL** (code ouvert) **ou** sous **licence commerciale** payante. À
  reconfirmer avant la Slice 3 (le worklet).
- **Stack `packages/web`** : React + **Jotai** (si besoin) · **Base UI** (headless)
  · **Every Layout** (primitives de layout en composants) · **CSS Modules** + tokens
  en variables CSS · convention **smart / dumb** (container / présentationnel).
- **Gates étendues** (bloquantes, scoped `packages/web`) : **impeccable**
  (`impeccable detect`) + **react-doctor**. Le core reste pur (sans React/CSS).

## Architecture — produit → hexagone

Le template est un starter CLI pur ; Loupe est une app Web Audio temps réel. La
frontière :

| Couche | Contenu | Pureté |
|---|---|---|
| **`@app/core`** | Domaine (modèles + math) + use-cases + **ports**. Zéro React/DOM/Web Audio. | Pur — TDD + property + mutation (Stryker) |
| **`packages/web`** → composants **smart** | Câblent les use-cases du core + ports + état Jotai. = adapters. | Impur — tests intégration |
| **`packages/web`** → composants **dumb** | Vue pure *props → JSX*. | impeccable + tests composant |

Le cœur reste « valeurs entrantes → valeurs sortantes », testable **sans
navigateur**. Tout le temps réel passe derrière un port. La convention smart/dumb
prolonge l'hexagone dans l'UI : *dumb = vue pure*, *smart = adapter*.

**Domaine pur identifié.** `Waveform` (échantillons → buckets min/max),
`Viewport` (mapping temps ↔ pixel), `TransportState` (reducer), `PlaybackRate` /
`PitchShift`, `Marker` / `MarkerList`, `LoopRegion` / `LoopLibrary`, `KeyBindings`.

**Ports (driven, implémentés côté web).** `AudioFileDecoder.decode(bytes)`,
`PlaybackEngine` (load / play / pause / seekTo / onPositionChange ; étendu en S3
par `setTimeRatio` / `setPitchSemitones`), `LoopStore` (persistance localStorage).

## Boucle de travail par slice

Chaque slice est une **tranche hexagonale verticale**, livrée seule, sur **sa
propre branche**, mergée par **PR**. Étapes :

1. `/new-feature-hexa` — outside-in : test d'acceptation du use-case d'abord, qui
   tire le domaine, puis l'adapter.
2. `/tdd-cycle` — red → green → refactor sur tout le code du core ; property-tests
   (fast-check) pour les invariants.
3. `pnpm gate` — la gate bloquante (étendue : + `check:design` + `check:react`).
4. `pnpm test:mutation` — Stryker scoped `@app/core`, avant le PR.
5. **`/code-review`** — revue de la diff de la slice avant de clôturer.
6. `/session-report` — met à jour `docs/STATUS.md` + rapport daté ; ship **dans** le PR.

## Slices

| # | Slice | Domaine pur (core) | Adapter (web) |
|---|---|---|---|
| **0** | Scaffold `packages/web` *(infra)* | — | Vite+React+TS, tokens CSS, polices, primitives Every Layout, Base UI, shell de layout, gate étendue |
| **1** | Import fichier local → waveform | `Waveform`, `Track` | `WebAudioDecoder` (`decodeAudioData`), `<input>`, canvas `WaveformRenderer` (ambre) |
| **2** | Transport play/pause/seek + playhead + Espace | `TransportState`, format mm:ss | `WebAudioPlayback`, playhead, raccourci Espace, clic-pour-seek |
| **3** | Time-stretch sans pitch + pitch-shift ⚠️ *gate licence Rubber Band* | `PlaybackRate`, `PitchShift` | **spike worklet** isolé, puis Rubber Band WASM dans un `AudioWorkletProcessor` |
| **4** | Marqueurs section / mesure / temps | `Marker`, `MarkerList` | règle timeline, sections nommées |
| **5** | Sélection A/B au glisser + boucles nommées *(la « loupe »)* | `LoopRegion`, `LoopLibrary` | `LoopStore`, drag-select, **effet loupe** (le reste s'assombrit), liste |
| **6** | Zoom + vue défilable (jusqu'à 6×) | `Viewport` (property-tests round-trip) | contrôles zoom/scroll, re-render des peaks |
| **7** | Raccourcis clavier | `KeyBindings` (map pure) | écouteur global ; a11y (focus visible, `prefers-reduced-motion`), responsive |

## Tokens de design (repris de la spec — règle sémantique à respecter)

**Ambre = tes réglages / ce qui joue ; cyan = ce que la machine a détecté.**

```
--bg:#13151C  --panel:#1A1D27  --panel-2:#21242F  --panel-3:#262A37
--line:#2C3040  --text:#E9E7E1  --dim:#8B90A3  --faint:#5A5F72
--amber:#E5A53D   /* ce qui joue / actif / la boucle-loupe */
--teal:#56B8C9    /* ce que l'IA a détecté */
/* stems */ voix:#E2897A  batterie:#7C86A6  basse:#A481C9  guitare:#8DB585  claviers:#6FA8D4
```

Polices : **Inter** (UI), **IBM Plex Mono** (toutes les données chiffrées :
timecodes, BPM, %, demi-tons, confiance), **Space Grotesk** (logo seul).

## Hors Jalon 1

Séparation IA (J2), analyse essentia.js / accords / BPM réels (J3 — placeholders
statiques au J1), MIDI / pédales / vidéo (J4), partition AlphaTab (J5).
