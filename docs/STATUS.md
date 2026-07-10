# STATUS

> Resumable source of truth, updated at the end of each step via
> `/session-report`. **Only the current step is detailed here** — the full
> story of every past step lives in its dated report under
> [docs/sessions/](sessions/); the history below keeps one line per step.

## Where we are

**Grilles d'accords Lot A/B done (2026-07-10, merged PR #77)** on branch
`feat/chord-chart-model` (off `main`): premier slice du
[plan chord-charts](chord-charts-plan.md) (gelé le même jour). **Le socle
lead-sheet** — modèle d'accords pur + saisie manuelle qui rend une grille en
direct. Core pur (TDD) :
[chord-symbol.ts](../packages/core/src/domain/chord-symbol.ts)
(`parseChordSymbol`/`formatChordSymbol` round-trip + `transposeChordSymbol`,
invariants fast-check) et
[chord-chart.ts](../packages/core/src/domain/chord-chart.ts)
(`ChordChart`/`Section`/`Measure` + `parseChart` du format grille maison
`[Section]` / `|` / accords espacés). Web : `LeadSheet` (rendu CSS Grid, zéro
lib) + `ChordChartPanel` (saisie → rendu live) câblé dans le shell. Format &
rendu **maison, zéro lib** (ChordSheetJS écarté GPL, Essentia AGPL) ; moteur
ACE arbitré = **BTC** (MIT/PyTorch) via deep-research, pour le Lot C à venir.
Slice réaligné en **outside-in** en cours de route (acceptance web →
`parseChart` → `chord-symbol`). À la reprise (même PR, après rebase sur le
count-in) : **7 survivants Stryker réels tués** → fichiers chord **100 %**
(global 94,52 %), et la **vérif navigateur a attrapé un vrai bug** (CSS sur
tokens inexistants → accords invisibles; corrigé sur `--line`/`--panel-2`,
textarea composé depuis `popover-form`). Gate **vert — 832 tests**, coverage
96,17 %/89,46 %. **Merged as PR #77.**

**Next: persistance `ProjectChordChart`** (signer la grille dans le manifest
comme `ProjectTempo`, lever l'état local du panneau vers un hook) ou **la
transposition UI** (qui tirera `transposeChordSymbol`, aujourd'hui non
exporté). Ensuite ou en parallèle : **Lot J** (fond de panier,
[roadmap-excellence-2](roadmap-excellence-2.md)). See
[2026-07-10-chord-charts-lot-a-b](sessions/2026-07-10-chord-charts-lot-a-b.md).

## Historique (une ligne par étape, du plus récent au plus ancien)

### Roadmap excellence 2 (Lots F → I, 2026-07-07 → 07-10)

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

- [roadmap-excellence-2.md](roadmap-excellence-2.md) — **en cours** (Lots F–I
  faits, reste Lot J; suivi coché en fin de fichier).
- [chord-charts-plan.md](chord-charts-plan.md) — **en cours** (figé le
  2026-07-10; Lot A/B sur `feat/chord-chart-model`).
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
