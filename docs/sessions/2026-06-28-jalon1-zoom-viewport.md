# Session — 2026-06-28 — jalon1-zoom-viewport

Jalon 1 · Slice 6 — zoom + scrollable viewport (la « loupe » jusqu'à 6×).

## Revision (post-review, prototype-aligned)

The first cut modelled the viewport as a pure ratio-space window (offset + peak
slicing + a pan slider). On review against the prototype/maquette this was wrong:
the product's zoom is a **slider that magnifies** while a **native horizontal
scrollbar** pans, with the **ruler, markers and waveform sharing one zoom-scaled
stage** so they stay aligned at any zoom. Reworked to match:

- **Core `Viewport` simplified to a zoom scalar** — `clampZoom` / `zoomIn` /
  `zoomOut` over `MIN_ZOOM…MAX_ZOOM` in `ZOOM_STEP` (0.5). Offset / `toViewRatio`
  / `visibleWindow` / `sliceWaveform` removed (panning is the DOM's job).
- **`ZoomStage`** (new dumb layer): one horizontally-scrollable frame whose inner
  width is `zoom × 100%`; holds the zoom pill, the playhead spanning all layers,
  and the auto-scroll that follows the playhead during playback. The ruler +
  markers and the waveform are its children, so they scale and scroll together.
- **`MarkerRail`** restyled to the prototype timeline: a mono timecode ruler +
  pin/tag markers (sections labelled, measures/beats are pins).
- **Sliders styled** globally (track + round knob, `data-accent` amber/teal).
- **Canvas** fills its frame (was a fixed 180px → truncated in the 134px box) and
  repaints on resize via a `ResizeObserver`.
- Zoom pill is the top-right overlay; the slider zooms (does not pan).

Tokens added: `--amber-deep`, `--amber-glow`, `--teal-deep`, `--line-soft`.

## Done
- **Pure `Viewport` domain** (`packages/core/src/domain/viewport.ts`) in
  normalised timeline-ratio space (`[0, 1]`, duration-independent):
  `initialViewport`, `zoomTo` (clamps `1×…6×`, keeps an anchor pinned on screen),
  `scrollTo` / `scrollBy` (offset clamped to `[0, maxOffset]`), `visibleWindow`,
  `maxOffset`, and the `toViewRatio` / `toTimelineRatio` mapping —
  **round-trip property-tested** (fast-check) both ways.
- **`sliceWaveform`** added to the waveform domain — re-renders only the peaks
  inside the visible window (always ≥ 1 peak, never blanks).
- **Web adapter**: `useViewport` smart hook (zoom around the *current view
  centre*, scroll, wheel-nudge, reset-on-import); dumb `ViewportControls`
  (− / level / + buttons + scroll slider, disabled until loaded / nothing off
  screen); `WaveformView` now slices peaks through the viewport, maps
  playhead / loop-dim / click / drag / horizontal-wheel through it, hides the
  playhead when off-screen, and memoises the slice so the canvas doesn't repaint
  on every playback tick. Wired into `WorkstationShell` (viewport resets on a new
  import alongside markers).
- Registered the viewport domain in
  [packages/core/src/application/README.md](../../packages/core/src/application/README.md).
- **`/code-review` (high)** run on the diff → 4 issues actioned:
  1. `sliceWaveform` returned an **empty** slice for a window flush at ratio 1
     (latent flaky property test) — fixed by clamping `lo ≤ total-1` + a guard test.
  2. wheel pan now acts on **horizontal intent only** (a plain vertical wheel
     scrolls the page rather than being half-consumed without `preventDefault`).
  3. zoom now anchors on the **view centre**, not the playhead (which could be
     scrolled off-screen and yank the view).
  4. **memoised** the sliced waveform (no full canvas repaint per playback tick).

## Not done / remaining
- Zoom re-renders the *existing* peaks (slice), not a re-bucket from raw PCM, so
  at 6× the envelope is chunkier than a fresh decode would give. Acceptable for
  this slice (plan says « re-render des peaks »); revisit if crispness matters.
- Vertical mouse-wheel does not pan (by design — use the slider or a horizontal
  swipe); a non-passive listener would be needed to pan + `preventDefault`.
- Browser-verify (manual) not done this session.
- Next: **Slice 7 — keyboard shortcuts** (`KeyBindings` pure map + global listener,
  a11y: focus visible, `prefers-reduced-motion`, responsive).

## Decisions
- **Viewport lives in normalised `[0, 1]` timeline-ratio space**, not seconds —
  decoupled from duration, and it dovetails with the existing playhead / loop /
  seek plumbing which already speaks timeline ratios.
- **Zoom anchors on the visible-window centre**, not the playhead — predictable
  and never jumps to an off-screen playhead.
- The two surviving viewport mutants (`< MIN_ZOOM` / `< 0` clamp boundaries) are
  **equivalent mutants** (both branches return the same value at the boundary).

## Gate status
- typecheck: ✅
- tests (with coverage): ✅ 133 passing (20 files); core thresholds met.
- mutation (Stryker, local, core touched): ✅ **95.44%** overall — `viewport.ts`
  95.35%, `waveform.ts` 95.38% (remaining survivors are equivalent mutants).
- biome / sheriff / knip / jscpd: ✅ — plus the web-only gates impeccable +
  react-doctor ✅.

## State to resume from
- **Single next action**: commit this report on `feat/jalon1-zoom-viewport`, push,
  open the PR, then start **Slice 7 (keyboard shortcuts)** via `/new-feature-hexa`.
- Gotchas / half-done edits: none — working tree is the finished slice, gate +
  mutation green. PR not yet opened at time of writing.
