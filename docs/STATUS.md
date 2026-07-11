# STATUS

> Resumable source of truth, updated at the end of each step via
> `/session-report`. **Only the current step is detailed here** — the full
> story of every past step lives in its dated report under
> [docs/sessions/](sessions/); the history below keeps one line per step.

## Where we are

**Lot C chord-charts — COMPLET (2026-07-11)** : les trois slices livrées le
même jour. **Core** (PR #86 mergée) : port `ChordDetector` + agrégation pure
`chordLabelPerMeasure` (1 accord/mesure sur les intervalles
downbeat→downbeat) + `renderChartSource` + use-case `detectChords` →
brouillon de texte source. **Serveur** (PR #87 mergée) : spike BTC levé
(2,4 s CPU / 257 s d'audio), `POST /chords` (BTC vendoré MIT, poids
sha256-pinnés, 503 sans torch/poids), helper pur `chord_spans`. **Web**
(branche `feat/detect-chords-ui`) : adapter `createHttpChordDetector`
(traduction mir→tokens, `N`/`X`→silence), hook `useChordDetection` (jeton de
run, brouillon = édition manuelle persistée), bouton « Détecter les accords »
(confirmation deux temps avant écrasement, hints actionnables serveur/grille,
LiveStatus a11y). Gate **vert — 925 tests** (+19), serveur 127 pytest.

**En cours : [feuille de route v3](roadmap-excellence-3.md)** (évaluation
notée du 2026-07-11, 16,0/20). **K.2 mergé (PR #89)** : `sanitizeBeatGrid` en
deux passes (double-fires vs médiane locale fenêtrée + bruit off-tempo vs
carte consolidée), support minimal par segment (4 gaps), filtre miroir
serveur, auto-réparation des projets persistés ; limite documentée : la
modulation métrique anticipée de beat_this (dbn testé, n'aide pas) → remède
produit « édition locale du tempo » en veille. **K.1 fait** sur
`feat/lead-sheet-scrollport` (PR à ouvrir) : scrollport
`clamp(14rem, 45dvh, 26rem)` autour du LeadSheet + suivi du playhead
(`scrollIntoView` nearest), browser-vérifié sur le projet réel.
**Lot K clos** (PRs #89/#90 mergées — + footer sticky). **L.1 mergé (PR #91)** :
le playhead vit hors de l'état React (`createExternalValue`, playhead impératif
dans ZoomStage) — **8 commits React/5 s de lecture contre ~60–120/s avant**.
**L.2 fait** sur `perf/zoom-stage-page-follow` (PR à ouvrir) : suivi du playhead
**par pages** (`followScrollLeft` pur — flip seulement quand le playhead sort de
la fenêtre, clampé), plus d'écriture `scrollLeft` par frame ni de reflow forcé
(lectures géométrie avant écriture), scroll manuel = suspension 2 s (écho
détecté par relecture du `scrollLeft` appliqué). Browser-vérifié ; gate verte,
**964 tests**. Limitation actée : seek/zoom pendant la grâce ne recadre pas
(≤2 s, s'auto-répare) ; gap relevé : le suivi lead-sheet (K.1) n'a pas de
suspension — slice `usePlayheadFollow` candidate.
**Next : merger la PR L.2, puis L.3** (mémoire stems) / L.4 (memo WAV) → M/N/O.
See [L.2](sessions/2026-07-11-zoom-stage-page-follow.md) ·
[L.1](sessions/2026-07-11-playhead-external-store.md) ·
[K.1](sessions/2026-07-11-lead-sheet-scrollport.md) ·
[K.2](sessions/2026-07-11-tempo-map-outliers.md) ·
[2026-07-11-detect-chords-ui](sessions/2026-07-11-detect-chords-ui.md) ·
[2026-07-11-chords-endpoint](sessions/2026-07-11-chords-endpoint.md) ·
[2026-07-11-chord-detection-core](sessions/2026-07-11-chord-detection-core.md).

## Historique (une ligne par étape, du plus récent au plus ancien)

### Roadmap excellence 3 (2026-07-11 → …)

- 2026-07-11 · **Évaluation notée v3** (16,0/20, six axes dont performance) :
  revue multi-agents vérifiée adversarialement, 35 constats confirmés →
  [roadmap-excellence-3](roadmap-excellence-3.md) (Lots K–O)

### Plan chord-charts (2026-07-10 → …)

- 2026-07-11 · **Lot C serveur + web — détection ACE bout-en-bout** (PR #87 +
  PR web) : `POST /chords` BTC vendoré sha256-pinné, adapter mir→tokens,
  bouton « Détecter les accords » → brouillon confirmé →
  [serveur](sessions/2026-07-11-chords-endpoint.md) ·
  [web](sessions/2026-07-11-detect-chords-ui.md)
- 2026-07-11 · **Lot C core — détection d'accords** (PR #86) : port
  `ChordDetector` + `chordLabelPerMeasure` + `renderChartSource` +
  `detectChords` → brouillon source →
  [rapport](sessions/2026-07-11-chord-detection-core.md)
- 2026-07-11 · **Sync lecture de la lead-sheet** (PR #80) : `measureIndexAt`
  pur (mesure ↔ intervalle downbeat→downbeat, projection jamais stockée),
  surlignage `aria-current` + bars-per-row configurable →
  [rapport](sessions/2026-07-11-chord-chart-playback-sync.md)
- 2026-07-10 · **Transposition de la grille** (PR #79) :
  `transposeChartSource(source, ±n)` réécrit le texte source en préservant la
  mise en page ; garde round-trip par token, accidentals unicode →
  [rapport](sessions/2026-07-10-chord-chart-transpose.md)
- 2026-07-10 · **Persistance de la grille** (PR #78) : `ProjectChordChart
  { source }` signé dans le manifest (absent ⇔ vide), état lifté au shell,
  restauré à l'ouverture, reset à l'import ; piège du test vacuement vert
  durci par import intermédiaire ; extraction `use-shell-drop.ts` →
  [rapport](sessions/2026-07-10-chord-chart-persistence.md)
- 2026-07-10 · **Lot A/B — socle lead-sheet** (PR #77) : `chord-symbol` +
  `chord-chart` purs (format grille maison, round-trip fast-check),
  `LeadSheet` CSS Grid zéro lib + saisie live ; moteur ACE arbitré = BTC
  (MIT) ; Stryker 100 % sur les fichiers chord ; vérif navigateur → fix
  tokens (accords invisibles) →
  [rapport](sessions/2026-07-10-chord-charts-lot-a-b.md)

### Roadmap excellence 2 (Lots F → J, 2026-07-07 → 07-11)

- 2026-07-11 · **Lot J — fond de panier** (PRs #81–#85 mergées) : tokens
  sémantiques, `:active`, dédup moteurs Web Audio, quota disque, annulation —
  roadmap-excellence-2 **entièrement cochée** →
  [rapport](sessions/2026-07-11-lot-j-fond-de-panier.md)
- 2026-07-09/10 · **Lot I.3 — count-in du métronome, LOT I COMPLET** (PR #76) :
  une mesure de clics avant le départ — atterrissage calé sur la grille,
  accents phasés sur la mesure du morceau, tempo entendu; adaptateur one-shot
  robuste à l'autoplay → [rapport](sessions/2026-07-09-metronome-count-in.md)
- 2026-07-09 · **Lot I.2 — tempo manuel** (PR #75) : tap-tempo (médiane), champ
  BPM éditable, calage de phase; `ManualTempo` signé/persisté →
  [rapport](sessions/2026-07-09-manual-tempo.md)
- 2026-07-09 · **Lot I.1 — speed trainer** (PR #74) : rampe de tempo par
  passes de boucle; plancher tempo 40 %; la boucle confine la tête →
  [rapport](sessions/2026-07-09-speed-trainer.md)
- 2026-07-08 · **Lot H — a11y live-regions** (PR #73) : séparation et
  détection tempo annoncées (primitive `LiveStatus`) →
  [rapport](sessions/2026-07-08-web-a11y-live-regions.md)
- 2026-07-08 · **Lot G — confiance utilisateur** (PR #72) : suppression
  deux-temps repère/boucle, erreurs actionnables (réimport, retry tempo),
  drop non-audio signalé → [rapport](sessions/2026-07-08-web-user-trust-lot-g.md)
- 2026-07-07 · **Lot F — hygiène serveur** (PR #70) : cap `/download` 🔴,
  sémaphore `/tempo`, `wav_decode` torch-free testé, README resync →
  [rapport](sessions/2026-07-07-server-hygiene-lot-f.md)
- 2026-07-06 · **Évaluation notée v2** (15,3/20) →
  [roadmap-excellence-2](roadmap-excellence-2.md) (Lots F–J, suivi coché en fin
  de fichier)

### Plan tempo (Lots A → C, 2026-07-06 → 07-07)

- 2026-07-07 · **Lot C — tempo variable** (PR #69) : `buildTempoMap`/`tempoAt`
  dérivés de la grille (jamais persistés), read-out suit la tête →
  [rapport](sessions/2026-07-07-tempo-map.md)
- 2026-07-06 · **Lot B.2 — serveur `beat_this`** (PR #68) : beats + downbeats
  transformer (mesure réelle), humble object `beat_positions` 100 % →
  [rapport](sessions/2026-07-06-tempo-beat-this-server.md)
- 2026-07-06 · **Lot B.1 — contrat `/tempo` enrichi** (PR #67) : `barPosition`
  par beat, `detectMeter`, `beatsPerBar` persisté →
  [rapport](sessions/2026-07-06-tempo-enriched-contract.md)
- 2026-07-06 · **Lot A — correction d'octave ×2/÷2** (PR #66) :
  `foldTempoOctave`, `octaveShift` signé/persisté →
  [rapport](sessions/2026-07-06-tempo-octave-toggle.md)

### Roadmap excellence 1 (Lots A → E, 2026-07-05 → 07-06)

- 2026-07-06 · **Lot E.1 — split `use-player`** : `use-loop` +
  `use-transport-engines` extraits (comportement préservé) →
  [rapport](sessions/2026-07-06-web-split-use-player.md)
- 2026-07-06 · **Lot E trio — dette de complexité** (PR #63) :
  `isSyntheticStem`, handler nommé, no-op map supprimé →
  [rapport](sessions/2026-07-06-web-complexity-debt-trio.md)
- 2026-07-06 · **Lot D.3 — feedbacks manquants** : garde URL inline, primitive
  toast (Base UI), confirmations export/save →
  [rapport](sessions/2026-07-06-web-feedbacks.md)
- 2026-07-06 · **Lot D.2 — « Séparer » ↔ santé serveur** : bouton désactivé +
  hint actionnable hors-ligne / sans moteur →
  [rapport](sessions/2026-07-06-web-separate-server-health.md) · D.1 undo/redo
  → veille (décision produit)
- 2026-07-05 · **Lot C.5 — micro-motion overlays** →
  [rapport](sessions/2026-07-05-web-overlay-micromotion.md)
- 2026-07-05 · **Lot C.4 — boutons unifiés + icônes SVG** →
  [rapport](sessions/2026-07-05-web-unify-buttons-icons.md)
- 2026-07-05 · **Lot C.3 — design system (type/élévation/z-index/radius)** —
  incl. le piège Base UI « z-index sur le Positioner » →
  [rapport](sessions/2026-07-05-web-design-system-tokens.md)
- 2026-07-05 · **Lot C.2 — responsive intrinsèque (Every Layout, 0 media
  query)** (PR #58) → [rapport](sessions/2026-07-05-web-responsive-tactile.md)
- 2026-07-05 · **Lot C.1 — DnD natif + empty-state** (PR #57) →
  [rapport](sessions/2026-07-05-web-dnd-empty-state.md)
- 2026-07-05 · **Lot B — discipline serveur** (PR #54/#55/#56) : pytest élargi,
  gate serveur CI torch-free (ruff+pyright+coverage), humble objects extraits →
  [B.1](sessions/2026-07-05-server-pytest-breadth.md) ·
  [B.2](sessions/2026-07-05-server-lint-types-ci.md) ·
  [B.3](sessions/2026-07-05-server-humble-objects.md)
- 2026-07-05 · **Lot A — sécurité serveur** (PR #48/#49/#50/#51) : pip runtime
  supprimé 🔴, CORS/TrustedHost, caps + semaphore + tmp durci, loopback-only →
  [A.1](sessions/2026-07-05-server-no-runtime-pip.md) ·
  [A.2](sessions/2026-07-05-server-cors-host.md) ·
  [A.3](sessions/2026-07-05-server-resource-limits.md) ·
  [A.4](sessions/2026-07-05-server-loopback-and-filename.md) — roadmap :
  [roadmap-excellence](roadmap-excellence.md)
- 2026-07-05 · **Housekeeping** : jscpd 14→7, tabs, coverage web gatée 85/80 →
  [rapport](sessions/2026-07-05-dry-tabs-coverage.md)

### Tronc fonctionnel (2026-07-03 → 07-04)

- 2026-07-04 · **UI clarity pass** (PR #46) : mix sommé, boucles en sidebar,
  séparation relocalisée → [rapport](sessions/2026-07-04-ui-workstation-clarity.md)
- 2026-07-04 · **Persistance métronome** (PR #41) : `ProjectTempo` sur le
  manifest, reopen sans serveur →
  [rapport](sessions/2026-07-04-metronome-persistence.md)
- 2026-07-04 · **Import depuis URL** (PR #42) : port `TrackSource`, yt-dlp
  serveur, menu Importer → [core](sessions/2026-07-04-import-from-url-core.md) ·
  [adapter+UI](sessions/2026-07-04-import-from-url-adapter-ui.md)
- 2026-07-04 · **Métronome-stem** (PR #40) : clic synthétisé comme stem du
  mixer, auto-détection à l'import →
  [rapport](sessions/2026-07-04-metronome-stem.md)
- 2026-07-03 · **Détection de tempo réelle** (PR #39, serveur librosa) →
  [rapport](sessions/2026-07-03-tempo-detection.md)
- 2026-07-03 · **Persistance tempo/pitch/zoom** (PR #38) →
  [rapport](sessions/2026-07-03-persist-tempo-pitch-zoom.md)
- 2026-07-03 · **i18n Lingui** (PR #37) + shell éclaté en régions →
  [rapport](sessions/2026-07-03-i18n-lingui.md)
- 2026-07-03 · **Garde session non enregistrée** (PR #36) →
  [rapport](sessions/2026-07-03-dirty-session-guard.md)
- 2026-07-03 · **UI polish** (PR #35) : marqueurs draggables, gutter DAW →
  [rapport](sessions/2026-07-03-ui-polish.md)

### Jalons fondateurs (2026-06-28 → 07-02) — tous livrés

- **Jalon 1 — atelier de base** (import/waveform, transport, time-stretch
  SoundTouch, repères, boucles A/B, zoom, raccourcis) : complet + poli —
  plan [jalon-1-plan.md](jalon-1-plan.md), rapports datés du 2026-06-28.
- **Jalon 2 — séparation IA** : serveur local FastAPI + Demucs
  (`htdemucs_6s`) derrière le port `StemSeparator` (les moteurs WASM
  in-browser ont été retirés), détection d'instruments, mixer multitrack,
  export stems zip. Clos le 2026-07-02 —
  plan [jalon-2-plan.md](jalon-2-plan.md),
  [vérif export](sessions/2026-07-02-jalon2-export-verify.md).
- **Jalon 3 — projets** : domaine `Project` pur, ports + use-cases, adapter
  serveur HTTP (blobs content-addressed), boucles par projet, save
  incrémental, races corrigées; polish (rename `server/`, renommage projet,
  GC blobs) mergé PR #43/#44/#45 —
  [polish](sessions/2026-07-04-jalon3-polish.md),
  [état de session UX](sessions/2026-07-02-ux-session-state.md).
- **J4.1 — import URL** livré avec le tronc fonctionnel (ci-dessus).

## Locked decisions (kickoff)

- **Time-stretch engine**: **SoundTouch** (`@soundtouchjs/audio-worklet`, MPL-2.0)
  — **REVISED (2026-06-28)**. Rubber Band was confirmed at Slice 3 start, but its
  only web wrapper (`rubberband-web`) crashes on live pitch change and is
  unmaintained; in-browser verification surfaced it. SoundTouch fixes the crash
  **and** lifts the GPL obligation — the product can ship under any licence.
- **Separation engine** — **REVISED (2026-06-30): a local server is now the default
  and required path.** In-browser WASM (demucs.cpp GGML / onnxruntime-web) hit a
  quality+speed wall (quantised models, wasm32 memory ceiling, no native GPU). A
  **FastAPI + Demucs** backend (`server/`, GPU-capable, outside the hexagon)
  implements the same `StemSeparator` port via an HTTP/NDJSON contract;
  `createSeparator` returns the HTTP adapter. **The in-browser WASM engines were
  removed** — server-side Demucs is the single supported engine. htdemucs weights
  are research-only — fine for this non-commercial tool, not for a commercial
  product.
- **Web stack**: React + Jotai · Base UI (headless) · Every Layout · CSS Modules +
  CSS-variable tokens · smart/dumb components.
- **Extra gates** (blocking, `packages/web` only): impeccable + react-doctor.
- **Per-slice loop**: `/new-feature-hexa` → `/tdd-cycle` → `pnpm gate` →
  `pnpm test:mutation` → **`/code-review`** → `/session-report` → PR.

## Plans

- [roadmap-excellence-3.md](roadmap-excellence-3.md) — **en cours** (Lots K–O,
  évaluation notée du 2026-07-11).
- [roadmap-excellence-2.md](roadmap-excellence-2.md) — **complet** (Lots F–J ;
  J en PRs #81–#85, suivi coché en fin de fichier).
- [chord-charts-plan.md](chord-charts-plan.md) — **complet** (Lots A/B/C
  livrés ; Lot D ChordPro = optionnel, en veille).
- [tempo-detection-plan.md](tempo-detection-plan.md) — complet (Lots A–C).
- [roadmap-excellence.md](roadmap-excellence.md) — complet (Lots A–E).
- [jalon-2-plan.md](jalon-2-plan.md) · [jalon-1-plan.md](jalon-1-plan.md) —
  complets.

## Veille / différé

- Boucle échantillon-exacte / crossfade au wrap (coûteux, si l'usage le réclame).
- Locale EN (infra Lingui prête, seul `fr` existe).
- Chemin clavier pour créer une boucle A/B (design à concevoir avant de coder).
- Thème clair (décision produit).
- Undo/redo (D.1) — écarté produit : faible ROI pour un outil de pratique.
- Off-thread zip/encode — l'export gèle l'UI quelques secondes (~229 MB
  mesurés) sur une piste de 4 min.
- Jalon 4 — export MIDI par stem (basic-pitch), différenciateur audio→notation.
- Dependabot PR #53 (`@vitejs/plugin-react` v6, breaking Babel→oxc) — reporté.
- Vieux manifests *séparés* : re-`attach` sur le detect fire-and-forget peut
  écraser des réglages de fader faits pendant la fenêtre de détection —
  s'auto-répare à la sauvegarde; corriger seulement si ça mord.
