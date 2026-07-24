# Session — 2026-07-09 — tempo manuel (roadmap-excellence-2 Lot I.2)

## Done
- **Merged PR #74** (Lot I.1 speed trainer) was already in `main`; branch
  `feat/manual-tempo` off it.
- **Lot I.2 — tempo manuel**, a full outside-in slice (tap-tempo, saisie BPM,
  calage de phase):
  - Pure domain in [tempo.ts](../../packages/core/src/domain/tempo.ts) (TDD,
    fast-check): `ManualTempo` (`bpm` + `phaseSeconds`, the two numbers a save
    signs), `normalizeManualBpm` (NaN/0/negative → no tempo — the `Number('')`
    lesson from the speed trainer; the rest clamps into 20–400),
    `buildManualGrid` (whole-track grid re-derived from bpm/phase/meter; beat
    instants are `phase + k·60/bpm`, a product, so no accumulated drift;
    downbeats counted through the anchor, which is always bar one),
    `appendTap` (2 s silence resets the sequence, 8-tap window) and
    `tapTempoBpm` (60 / **median** inter-tap interval — one rushed tap doesn't
    skew).
  - `useTempo` grows the manual authority: `overrideBpm` (keeps the current
    downbeat phase, resets the octave shift, supersedes any in-flight
    detection — same run-token dance as `set`), `alignPhase` (re-anchors a
    downbeat exactly on the playhead, keeps the tempo), `manual` state; a
    fresh detection or reset clears the override; a fold over an override
    scales its bpm too so the save persists what the read-out shows; `set`
    gains the third `manual` argument for the restore path.
  - Web: [use-tap-tempo.ts](../../packages/web/src/app/tempo/use-tap-tempo.ts)
    (ref-held taps, injectable clock, `performance.now()` in real use);
    `useTempoDetection` gains `setBpm` / `alignPhase` / `tap`, each re-seating
    the click — `seatManualClick` **enables** the metronome when the manual
    tempo is the FIRST tempo (the tap/type fallback after a failed detection)
    and reseats it otherwise, with the same separation-owns-the-mixer guard as
    `runDetect`.
  - TempoPanel: the BPM read-out **is now an editable number field** (draft
    state shields typing from the per-frame felt read-out; Enter/blur commit,
    Escape abandons; an emptied field commits NaN, never 0), « Tap » always
    offered (it is the no-server fallback), « Caler » once a tempo exists,
    « Manuel » badge when the analysis is an override. 8 new Lingui ids
    (`tempo.bpm-field/unit/tap/tap-short/align/align-short/manual-badge`),
    extracted.
  - **Persistence**: `ProjectTempo.manual` (the persisted grid/bpm are already
    the override's; the spec restores the override state so further edits
    continue from it), `sessionSignature` signs the override (`null` when
    absent, so old manifests and untouched detections sign equal — it is a
    user edit, unlike the derived detection), restore passes it back through
    `tempo.set`.
- **Shell-level acceptance** (jsdom, full journeys): type 96 in the field →
  read-out + 17-beat grid + badge; three taps at 500 ms with a dead detector →
  120 BPM; « Caler » pulls the 0.25 s-anchored grid onto the playhead;
  save → reopen restores the override without re-detecting.
- **Mutation-driven hardening**: Stryker's re-seeded fast-check run caught a
  real float edge — a denormal negative phase underflows `(-phase·bpm)/60` to
  0 and emitted a beat at a negative instant. Fixed with a symmetric forward
  correction loop; pinned the counterexample and a brute-forced
  ceil-overshoot case (bpm 21, phase 15·60/21 — a beat sits exactly on 0) as
  unit tests, plus the exact-2 s tap-reset boundary.

## Not done / remaining
- **Eyes-only check** (browser-verify-only-hard-cases): the BPM field + Tap /
  Caler buttons layout in the tempo row (reuses the octave-button skin, low
  risk); VoiceOver on the field's label if a Lot-H-style pass comes back.
- The BPM field commits integers from typing but keeps a tapped tempo
  fractional (display rounds) — deliberate; revisit only if the read-out
  confuses.
- No dedicated meter (beats-per-bar) editor: a manual override keeps the
  detected meter (or 4/4 when none) — out of the roadmap's scope for I.2.

## Decisions
- **The override is two numbers, not a grid**: `ManualTempo = {bpm,
  phaseSeconds}` — the grid re-derives from them + meter + duration. They are
  what the user edited, so they are exactly what `sessionSignature` signs
  (roadmap: « l'override devient signé, contrairement au dérivé »).
- **The user's tempo is an authority**: `overrideBpm`/`alignPhase` supersede
  any in-flight detection (run-token bump); conversely a *completed* fresh
  detection or a reset clears the override (a new track / a deliberate
  re-analyse wins).
- **Phase is kept across BPM edits** (prior anchor, else the detected
  downbeat, else 0) and **« Caler » anchors bar one on the playhead** — the
  musician's gesture: pause on the one, press Caler.
- **Tap reads the median interval** over an 8-tap window that self-resets
  after 2 s — matches the server-side detector's median primitive, robust to
  one rushed tap.
- **Manual tempo is the fallback when detection fails**: field + Tap render
  with no analysis at all, and the first manual tempo *seats* the metronome
  (not just reseats).
- The `ceil` start-index in `buildManualGrid` is a fast guess corrected by
  two exact loops — mutants on the guess expression are **equivalent by
  construction** (the loops converge regardless).

## Gate status
- typecheck: ✅
- tests (with coverage): ✅ **772 passed** (76 files; +29 this session) —
  coverage 95,97 % stmts / 88,70 % branches (thresholds 85/80)
- mutation (Stryker, local — core touched): ✅ **94,94 %** overall;
  `tempo.ts` **95,08 %** (9 survivors, hand-verified: 5 equivalent-by-
  correction-loop on the `ceil` guess, `((k % bar)+bar) % bar` algebraic
  equivalent, NaN-propagation equivalents on the guard and `appendTap`, and
  2 pre-existing in `buildTempoMap`/`deviates` untouched by this lot);
  `detect-tempo.ts` 100 %
- biome / sheriff / knip / jscpd: ✅ / ✅ / ✅ / ✅; impeccable + react-doctor ✅

## State to resume from
- **Single next action**: open the PR for `feat/manual-tempo` (gate green,
  mutation done), merge, then **Lot I.3** (count-in du métronome — une mesure
  de pré-roll, pure dans `core`, seating dans l'adaptateur) or intercaler un
  Lot J (fond de panier, ≤ ½ session chacun).
- Gotchas: `useTempo.set` now takes `(analysis, octaveShift, manual?)` — any
  new restore path must pass the third argument or the override silently
  drops. `SignedSession.tempo` and `liveSignature` both carry `manual`; keep
  the two sides in lockstep or the « Enregistré » read-out lies. The BPM
  field's Testing-Library role is **spinbutton** (`tempo.bpm-field`); the
  shell spec helper `expectBpmReadout(bpm)` waits on its value. The tap test
  mocks `performance.now` — restore it or later tests inherit the mock.
  `buildManualGrid` guards non-finite durations precisely to avoid an
  infinite loop on `Infinity`.
