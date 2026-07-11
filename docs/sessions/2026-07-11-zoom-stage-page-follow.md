# Session — 2026-07-11 — zoom-stage-page-follow (Lot L.2)

## Done
- **Pure helper `followScrollLeft`** (`packages/web/src/app/waveform/follow-scroll.ts`,
  TDD, 6 example tests): given `{playheadX, scrollLeft, clientWidth, scrollWidth}`,
  returns the new `scrollLeft` **only when the playhead leaves the visible
  window** (DAW page-flip: playhead lands at the left edge), `null` otherwise.
  Clamped to `[0, scrollWidth - clientWidth]`; the exact right-edge pixel counts
  as out (`>=`).
- **ZoomStage rewired** (`zoom-stage.tsx`): the per-frame
  `scrollLeft = centred` write is gone. The position tick now reads geometry
  **before** the `playhead.style.left` write (no more forced reflow per frame),
  calls the helper, and writes `scrollLeft` only on a page flip.
- **Manual-scroll grace**: a `scroll` event that isn't the follow's own write
  (echo detected by **reading back the applied `scrollLeft`** after writing, ±1px)
  suspends the follow for 2 s (`MANUAL_SCROLL_GRACE_MS`, timestamp-deadline ref —
  no timer lifecycle). Listener is `{ passive: true }`.
- 4 new ZoomStage specs (in-view no-scroll, page flip, suspension, resume after
  grace) with mocked jsdom geometry + fake timers. **964 tests** (+10 vs L.1).
- **Browser-verified** on a synthetic 60 s WAV at zoom ~2.5×: `scrollLeft` stays
  put during in-view playback, flips exactly at the right edge (0 → 829 =
  clientWidth), manual scroll holds for the grace (stayed at 50 with playhead
  out of view), then resumes to the clamped last page (1243 = max scroll).
- **/code-review (8 angles + verify)** applied: lower clamp to 0, `>=` edge,
  read-back echo detection (browser clamping would have falsely suspended the
  follow near the timeline end), read-before-write reflow fix, timer → deadline
  simplification. `doctor.config.json`: `no-pass-data-to-parent` suppressed for
  `zoom-stage.tsx` (store-subscription false positive, same family as L.1).

## Not done / remaining
- **Accepted limitations (by design, self-heal in ≤2 s)**: a seek (marker click,
  keyboard jump) or a zoom change **during** the 2 s grace doesn't recenter;
  a zoom-out near the timeline end can misread the browser's clamp event as a
  manual scroll. Distinguishing seek vs loop-wrap at ZoomStage level needs a
  product call — revisit only if it bites.
- **Altitude gap filed**: the lead-sheet playhead-follow (K.1,
  `lead-sheet.tsx` `scrollIntoView`) has **no** manual-scroll suspension — the
  sheet yanks back on the next measure change while the user reads elsewhere.
  Candidate follow-up slice: shared `usePlayheadFollow` (grace + own-write
  filtering) consumed by both scrollports.
- Long loops (> one page) page-flip twice per pass — inherent to the pattern.

## Decisions
- Page-follow lands the playhead at the **left edge** (full page of lookahead),
  not centred — fewer scroll writes, classic DAW behavior.
- Own-write detection = read back the **applied** `scrollLeft` after writing
  (browser may clamp/round the requested value), compared ±1px in the scroll
  listener; suspension = timestamp deadline (`Date.now`), no timer to clean up.
- Geometry reads happen before any style write in the tick — invariant to keep
  when touching `apply()`.

## Gate status
- typecheck: ✅ (via `pnpm gate`, exit 0; re-run by the pre-commit hook)
- tests (with coverage): ✅ 964 tests, 86 files — statements 96.37 %, branches 90.29 %
- mutation (Stryker, local, if core touched): **skipped — `@app/core` untouched**
  (web-only slice; Stryker scope is core)
- biome / sheriff / knip / jscpd: ✅ (jscpd: 6 pre-existing clones, none new);
  react-doctor ✅ (one new file-scoped suppression, see Done)

## State to resume from
- **Single next action**: merge the L.2 PR, then start **L.3** (stems memory:
  drop the duplicated PCM retention, avoid the transient `Float32Array.from`
  copy — see roadmap-excellence-3.md) or the filed `usePlayheadFollow` slice.
- Gotchas / half-done edits: none on the branch. The 2 s grace constant lives in
  `zoom-stage.tsx` (`MANUAL_SCROLL_GRACE_MS`); jsdom specs pin geometry via
  `Object.defineProperty` (`mockGeometry` in `zoom-stage.spec.tsx`). Untracked
  junk at repo root (`doctor.config.json`, a chart PDF) is not part of any step.
