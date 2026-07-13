# Session — 2026-07-13 — structure detection S.3b (grid re-labeling)

Phase 2 of the lead-sheet lot, step 3b (web + a core fold). « Détecter la
structure », when a chord grid already exists, **re-labels it** — the neutral
`[A]`/`[B]` the repetition deduces give way to the detected section names
(`[Couplet]`/`[Refrain]`). Plan:
[structure-detection-plan.md](../structure-detection-plan.md). Follows S.3a
(markers only, PR #120 merged); the product call that deferred S.3b was
resumed this session (trigger chosen: **the structure button relabels the
existing grid**, keeping its chords).

## Done

- **Core fold `relabelChartBySections(source, sections, grid, barsPerRow)`**
  ([chart-structure.ts](../../packages/core/src/domain/chart-structure.ts)) —
  reads the grid as its **played** measures (`unrollChart`, so a `|: … :|`
  grid stays aligned with the section times, which live in playback seconds),
  each measure taken as its first chord (the flat one-token model the printer
  round-trips). Maps each snapped section's `startSeconds` → a measure index by
  counting downbeats, cuts the flat labels at those bounds (clamped
  non-decreasing, first section opens at 0), one block per section headed by
  its label, drops a block a section beyond the grid leaves empty, renders via
  `renderStructuredSource`. **No cross-section voting** — chords are kept
  verbatim, so the key offset the caller carries stays valid. A blank grid, a
  gridless chart (one block under the first name), or a section-less detection
  passes through untouched. Public export (family of `transposeChart` /
  `renderChartSource`, not a detection fold). **10 unit + 1 property test**
  (no measure lost/invented against the played grid).
- **`section-markers.ts`** grew `sectionDisplayLabel(raw)` (the raw→display
  resolution `sectionMarkers` already did, extracted) so markers and grid
  headers name a section alike.
- **`relabel-chart.ts`** (`markers/`) — the web bridge: translates the raw
  section labels to display copy, then calls the core fold. Translating is the
  adapter's job; the core stays vocabulary-agnostic.
- **`useStructureMarkers`** — on a landed detection, besides placing the
  markers, relabels the grid **when it has content and the tempo grid has
  downbeats**, through `chart.setSource` (keeps the key offset, unlike a draft).
- **`MarkerControls`** — the two-step confirm now arms on `hasMarkers || hasGrid`
  and names exactly what is at stake: « Remplacer les repères et la grille ? »,
  « Réétiqueter la grille d'accords ? », or the S.3a « Remplacer les repères ? ».
- **Shell wiring** — the chord session is built **before** the structure flow
  (it relabels that same source), `chart` threaded into `useStructureMarkers`;
  `hasGrid` = grid source non-empty **and** a beat grid exists (matches the
  relabel guard, so the confirm never over-promises).

## Deliberate v1 limits

- A hand-edited multi-chord bar collapses to its **first** chord (the flat
  one-token-per-measure model `renderChartSource` requires); auto-drafts are one
  chord per bar, so this only bites manual edits — and it is behind a confirm.
- Repeat-folding is dropped: each section prints under its own header (no
  `|: … :|` collapse of two identical verses). Chords are preserved exactly.

## Gate

Gate **green — 1249 tests** (+13). react-doctor clean (WorkstationShell kept
under 300 lines). Stryker (core touched): see STATUS.

## Next

Retrofit `/tempo` on `classifyTransportError` still noted. Lot P/S wrap-up.
