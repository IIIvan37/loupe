# Session — 2026-07-03 — persist-tempo-pitch-zoom

## Done
- **The UX-backlog « tempo/pitch/zoom persistence » slice** — the real fix the
  dirty-session-guard session flagged: the playback tuning is now part of a
  saved project and of the dirty fingerprint, so it round-trips through
  save/open like loops and markers.
  - **Core (TDD, outside-in)**: new pure `ProjectTuning` (`timeRatio` /
    `pitchSemitones` / `zoom`) on `Project` (optional key, omitted when absent
    under `exactOptionalPropertyTypes`) and on `SessionSnapshot`;
    `projectFromSession` carries it through. New `tuningOrDefault(tuning?)`
    normalises an **absent** field (a manifest that predates it) to the neutral
    tuning `(1, 0, 1)` — the single place the « old manifest » rule lives, so
    the fingerprint and the restore path agree. `saveProject` threads
    `input.tuning`. Both exported from `index.ts`; registry updated.
  - **Web signature**: `SignedSession` gains an optional `tuning`;
    `sessionSignature` signs `tuningOrDefault(session.tuning)` so (a) any
    tempo/pitch/zoom change flips « Non enregistré », and (b) an old manifest
    without the field still signs equal to an explicit neutral one (« Enregistré »
    right after open).
  - **Web save/restore**: `SessionSnapshot`/`sessionSaveInput` carry a
    (mandatory, always-live) `tuning`; `restoreSession` seats it via a new
    `restoreTuning` dep (`tuningOrDefault` applied, so old manifests seat
    neutral instead of bleeding the previous session's tempo/pitch).
    `useProjectSession` feeds `deps.tuning` into both `liveSignature` and
    `handleSave`. The shell wires `tuning: { timeRatio, pitchSemitones, zoom:
    viewport.zoom }` and a `restoreTuning` that re-seats through the clamping
    player setters (`setTimeRatio` / `setPitchSemitones` / `viewport.setZoom`),
    so a hand-edited manifest stays in range.
- **Review-found bug fixed (Finding 1)**: importing a new file reset only the
  zoom (via `startFreshTrack`), leaving the previous track's tempo/pitch to
  bleed into an unrelated track — and now that tuning would be **saved** with
  it. `importFile` (`use-player.ts`) now resets `timeRatio`/`pitchSemitones` to
  neutral next to the existing loop-region reset. On project open the reset runs
  (via `importFile`) *before* `restoreTuning`, so the saved tuning still wins —
  verified by the reopen test.

## Not done / remaining
- **Browser-verify on the Mac** (this WSL2 PC has no Chrome): slow to 85 %,
  pitch −2, zoom 3×, save, reload, reopen → same tuning restored and the
  header reads « Enregistré »; change any of the three → « Non enregistré ».
- Rest of the UX backlog: real tempo detection, speed trainer, undo,
  off-thread zip/encode. Jalon 3 polish (project rename, blob GC,
  `separator-server/` → `server/`).

## Decisions
- **`tuningOrDefault` is the one seam for the « absent = neutral » rule**, used
  identically by the fingerprint (`session-signature.ts`) and the restore path
  (`project-session.ts`). Diverging them would make an untouched reopened old
  project read dirty.
- **`SessionSnapshot.tuning` is mandatory** (not optional like `activeLoop`):
  the tuning is always live (defaults exist), so there is no « no tuning » state
  to model — unlike an armed loop, which may genuinely be absent.
- **Reset-on-import lives in `importFile`**, beside the loop reset — the one
  place a fresh track's per-track state is seeded, and it runs before
  `restoreTuning` on the open path (correct order, no new plumbing).
- **Accepted limitation (review Finding 2, not a reachable bug)**:
  `sessionSignature` fingerprints the raw persisted tuning while `restoreTuning`
  re-clamps it, so a **hand-edited / out-of-range** manifest could read « Non
  enregistré » right after open. Unreachable through the app — every value the
  app persists was already clamped by the setters before it reached state, so a
  loupe-written manifest is always canonical. Not worth coupling the signature
  to the clamp functions for tampered input.

## Gate status
- typecheck: ✅
- tests (with coverage): ✅ **438 passed** (was 425; +13)
- mutation (Stryker, local): ✅ **95.79 %** overall, `project.ts` **100 %**
  (26/26 killed). Run before the review fix; the fix touched only
  `packages/web` (`use-player.ts`), not a mutated package.
- biome / sheriff / impeccable / react-doctor / knip / jscpd: ✅ (`pnpm gate`
  exit 0, also at pre-commit)

## State to resume from
- **Single next action**: push `feat/persist-tempo-pitch-zoom`, open the PR
  (report included), then browser-verify on the Mac before merge.
- Gotchas / half-done edits: none. The tuning restore relies on `importFile`
  running before `restoreTuning` inside `restoreSession` — keep that order if
  the open path is refactored. Range-slider tests use `fireEvent.change`
  (user-event cannot drive `<input type="range">`).
