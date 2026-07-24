# Session — 2026-06-28 — jalon1-markers

Slice 4 of Jalon 1: **timeline markers** (section / measure / beat). Built
outside-in; core gated + mutation-tested; UI fully testable in jsdom. Branch
`feat/jalon1-markers`, PR opened.

## Done

- **Core (pure hexagon), TDD strict:**
  - `Marker` (`domain/marker.ts`) — `{ id, timeSeconds, kind, label }`,
    `kind` = `section | measure | beat`.
  - `MarkerList` (`domain/marker-list.ts`) — `addMarker` (sorted insert, stable on
    equal times, replaces same `id`), `removeMarker`, `emptyMarkerList`. Unit +
    fast-check (always time-sorted). `marker-list.ts` mutation **100%**.
  - No new port: markers are in-memory and UI-driven (persistence is Slice 5).
- **Web adapters (`packages/web`):**
  - `useMarkers` hook — owns the list, mints `id` (`crypto.randomUUID`) and the
    auto label per kind, exposes `addAt` / `remove` / `clear`.
  - Dumb `MarkerControls` (+ Section / + Mesure / + Temps, disabled until loaded)
    and `MarkerRail` (places each marker at its fraction of the duration; amber per
    the token rule, weighted by kind — sections labelled, measures medium, beats
    faint; click to seek, ✕ to remove).
  - `usePlayer` gains `seekToSeconds` (absolute seek for marker clicks);
    `seekToRatio` now delegates to it.
  - Shell wires it: add at the playhead, click a marker to seek, and **markers
    clear when a new track is loaded**.

## Not done / remaining

- Auto label numbering is by current count of the kind, so removing then adding
  can repeat a label (e.g. two "Section 2"). Cosmetic — `id` is the key, not the
  label. A monotonic counter would fix it if it ever matters.
- No keyboard navigation between markers yet (Slice 7).
- No persistence — markers live for the session only (the `LoopStore` /
  localStorage work is Slice 5).

## Decisions

- **Markers are pure domain, no port.** Like the transport, they're UI-driven
  in-memory state over pure `MarkerList` functions; identity/labels are minted in
  the adapter to keep the core deterministic.
- **Amber, weighted by kind.** Markers are "your settings" → amber (token rule);
  the section/measure/beat hierarchy is shown by line weight/opacity rather than
  new colours (teal stays reserved for machine-detected data).

## Gate status

- typecheck: ✅
- tests (with coverage): ✅ 86 passing; core meets its 90% threshold.
- mutation (Stryker, local, core touched): ✅ **95.15%** (break 80);
  `marker-list.ts` 100%. Remaining survivors are equivalent boundary mutants in
  earlier slices' clamps.
- biome / sheriff / knip / jscpd: ✅.
- extended gates (`packages/web`): impeccable ✅ · react-doctor ✅.

## State to resume from

- **Single next action**: start **Slice 5** — A/B loop drag-select + named loops
  (the « loupe »): pure `LoopRegion` / `LoopLibrary` domain + a `LoopStore` port
  (localStorage), drag-select on the waveform, the loupe effect (the rest dims),
  and a saved-loops list. Outside-in via `/new-feature-hexa`.
- Gotchas / half-done edits: none — tree committed on the feature branch.
