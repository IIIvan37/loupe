# Session — 2026-06-28 — jalon1-loops

Slice 5 of Jalon 1: **A/B loops — the « loupe »** (drag-select + named, persisted
loops). Built outside-in; core + use-cases gated and mutation-tested; UI testable
in jsdom. Branch `feat/jalon1-loops`, PR opened.

## Done

- **Core (pure hexagon), TDD strict:**
  - `LoopRegion` (`domain/loop-region.ts`) — `makeLoopRegion` (normalise to
    start ≤ end), `loopContains` (half-open), `wrapToLoop` (jump to start at the
    end), `loopLength`. Property-tested.
  - `LoopLibrary` (`domain/loop-library.ts`) — `NamedLoop` + `addLoop` (sorted by
    start, replaces same id) / `removeLoop` / `emptyLoopLibrary`.
  - New driven port `LoopStore` (`load` / `save`).
  - Use-cases (`application/loops.ts`) — `loadLoops` / `saveLoop` / `deleteLoop`,
    orchestrating the domain + the `LoopStore` port; persistence is best-effort.
    `loops.ts` mutation **100%**.
- **Web adapters (`packages/web`):**
  - `createLocalStorageLoopStore` — `LoopStore` over localStorage; load and save
    are both guarded (corrupt/blocked storage → no loops, never throws).
  - `useLoops` hook — loads the library on mount, runs the use-cases.
  - `usePlayer` gains the active `loopRegion` + `setLoopRegion`, and **loops
    playback**: on each position tick a non-degenerate loop wraps back to its start.
  - `WaveformView` — **drag to select** an A/B region (click vs drag by a
    threshold), the **« loupe » dim overlay** outside the region, plus the playhead.
  - Dumb `LoopBar` — save the current selection (name via prompt), clear it, and a
    recallable saved-loops list (activate seeks to start; ✕ removes). Amber tokens.
  - Shell wires it all; the active loop clears when a new track loads.

## Not done / remaining

- Loops are **global**, not per-track — recalling a loop saved against another
  file places it by absolute seconds. Per-track keying (by a track id) is a
  follow-up; needs track identity the core doesn't model yet.
- Naming uses `window.prompt` — fine for now; an inline rename UI would be nicer.
- Saved loops aren't shown on the timeline (only in the bar); a saved-region
  overlay could come with the zoom slice.

## Decisions

- **Persistence is a driven port + use-cases.** Unlike markers (in-memory), loops
  persist, so they get a `LoopStore` port and `loadLoops`/`saveLoop`/`deleteLoop`
  use-cases — the first persistence vertical in the app, mirroring the example
  `greet` source/sink pattern. Best-effort writes (storage failure never breaks UX).
- **Tempo-style threshold for drag vs click.** A press that moves less than 0.5 %
  of the width is a seek; more is a loop selection — one surface, two gestures.
- **Loop-wrap lives in the smart hook**, reading a fresh `loopRef`, using the pure
  `wrapToLoop`; the transport reducer stays loop-agnostic.

## Gate status

- typecheck: ✅
- tests (with coverage): ✅ 104 passing; core meets its 90% threshold.
- mutation (Stryker, local, core touched): ✅ **95.45%** (break 80); `loops.ts`
  100%. Remaining survivors are equivalent/benign (equal-start ordering, boundary
  `<`/`<=`).
- biome / sheriff / knip / jscpd: ✅.
- extended gates (`packages/web`): impeccable ✅ · react-doctor ✅ (fixed a
  rebuilt-every-render pure function flagged in `WaveformView`).

## State to resume from

- **Single next action**: browser-sanity-check the loupe (drag → dim + loop
  playback; save/recall persists across reload), then start **Slice 6** — zoom +
  scrollable viewport (up to 6×): pure `Viewport` (time ↔ pixel mapping, round-trip
  property-tested) + zoom/scroll controls re-rendering the peaks. Outside-in.
- Gotchas / half-done edits: none — tree committed on the feature branch.
