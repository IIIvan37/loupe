# Session — 2026-07-13 — structure detection S.2 (core)

Phase 2 of the lead-sheet lot, step 2: the pure core that turns the server's
raw-second sections into beat-aligned structure. Plan:
[structure-detection-plan.md](../structure-detection-plan.md). Follows S.0
(spike) + S.1 (server `/structure`, PR #118 merged).

## Done

- **`domain/song-structure.ts`** — `DetectedSection { startSeconds, endSeconds,
  label }` (mirrors `DetectedChordSpan`) + **`snapSectionsToGrid`**: snap section
  boundaries onto the nearest downbeat with the rules **measured** on real
  tracks (beat_this vs SongFormer, median jitter 0.14 s):
  - snap an interior boundary to the nearest downbeat only within one bar
    (median gap); a beatless zone (pickup, outro fade) stays raw;
  - keep the first boundary at the track start and the last at the track end;
  - collapse a sub-bar section whose boundaries meet on one downbeat;
  - **monotonic**: a snap is taken only when its downbeat stays inside the raw
    endpoints, then clamped to never fall behind the previous boundary — an
    interior boundary can't cross an endpoint (a pickup) and invert the
    timeline (review fix).
- **`application/detect-structure.ts`** — `detectStructure` use-case: hand the
  PCM to the `StructureDetector` port, reject invalid sections (non-finite,
  non-positive length, blank label), snap to the grid. Unlike `detectChords` it
  does **not** require a grid — the « detect structure » button places markers
  before tempo is known, so an empty grid just skips snapping. Typed
  `StructureDetectionError` codes end-to-end (Lot G).
- **`StructureDetector` port** (mirrors `ChordDetector`) + public exports
  (`DetectedSection`, the use-case; the `snapSectionsToGrid` fold stays internal
  like `chordLabelPerMeasure`) + `application/README.md` entry.
- **Review (2-angle, verified) → fixes**: the endpoint-crossing inversion, the
  missing length/label validation, and unexporting the domain fold.

## Not done / remaining

- **S.3 — web** (UI slice, needs the approach checkpoint): `createHttpStructure
  Detector` adapter + `useStructureDetection` hook + the separate « Détecter la
  structure » button placing structure **markers** (arbitrated) and feeding the
  chord draft. Markers v1 are ordinary labelled markers (no new domain).

## Decisions

- **Snap is monotonic and endpoint-anchored** — the measured rules, plus the
  order-preserving guard the review surfaced. Ties break to the earlier
  downbeat (nearest-search keeps the first on equal distance).
- **No grid required** — structure detection is independent of tempo (the button
  works standalone), so an empty grid returns unsnapped raw-second sections.
- **`snapSectionsToGrid` stays internal** — adapters consume the use-case, never
  the domain fold, matching the chord slice.

## Gate status

- typecheck : ✅
- tests (with coverage) : ✅ **1207 tests** (+24 vs S.1), core coverage gate met
- mutation (Stryker, targeted `song-structure.ts` + `detect-structure.ts`) :
  ✅ `detect-structure` 100 %, `song-structure` ~91 % — remaining survivors are
  equivalent mutants (the `bar === undefined` / `downbeats.length < 2` guards
  produce output identical to falling through via NaN comparisons)
- biome / sheriff / knip / jscpd / react / tokens : ✅

## State to resume from

- **Single next action**: open + merge the S.2 PR (branch
  `feat/p-structure-core-s2`, incl. this report), then start **S.3 web** with
  the UI approach checkpoint (button + markers against the plan).
- Gotchas:
  - `noUncheckedIndexedAccess`: index into arrays via `.map()`/`.at()` or an
    `as` cast in core (the repo convention).
  - Run targeted Stryker from the REPO ROOT (`npx stryker run --mutate "<comma
    glob>"`), not from `packages/core` (no `test` script there); run it alone —
    a concurrent `pnpm gate` flakes the coverage threshold via the `.stryker-tmp`
    sandboxes.
