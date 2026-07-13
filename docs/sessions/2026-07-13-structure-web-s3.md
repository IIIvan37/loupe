# Session — 2026-07-13 — structure detection S.3 (web, markers)

Phase 2 of the lead-sheet lot, step 3 (web slice). The « Détecter la
structure » button in the markers bar: it calls the local server's
`/structure` engine and drops **section markers** on the timeline. Plan:
[structure-detection-plan.md](../structure-detection-plan.md). Follows S.2
(core `detectStructure` + snap, PR #119 merged). Approach checkpoint was taken
2026-07-13; a product call this session **scoped the PR to S.3a (markers only)**
— chart re-labeling is deferred to S.3b once the marker UX is validated.

## Done

- **`createHttpStructureDetector`** (`audio/http-structure-detector.ts`) —
  decalque of the chord adapter: `POST /structure` via the shared
  `postWavForJson` (AbortSignal threaded, O.5), wire
  `{segments:[{start,end,label}]}` → `DetectedSection[]`. Labels pass through
  **raw** (`verse`, `chorus`…) — translating to display copy is the UI's job,
  matching the port's documented contract. Transport failures typed as
  `StructureDetectionError` (503/504/413/network), the rest untyped → `unknown`.
  Factory `create-structure-detector.ts` (coverage-excluded with its twins).
- **`useStructureDetection`** (`markers/`) — mirror of `useChordDetection`:
  monotonic run token, per-run `AbortController` (aborts the previous run + on
  track swap + unmount), three-part commit guard (run id, audio identity,
  aborted), prev-prop state reset, `console.error` diagnosis + typed error code.
  Hands the snapped sections to `onSections`. **No grid required** — works
  before the tempo is known (empty grid skips snapping in the use-case).
- **Marker placement** — `section-label.ts` (SongFormer vocab → Lingui
  descriptors, unknown → passthrough) + `sectionMarkers()` (a marker per
  section start, label resolved through the i18n singleton) +
  `useMarkers.setSections` (mints ids, **replaces** the whole list — detection
  owns the timeline). `useStructureMarkers` bundles the hook + mapping for the
  shell (keeps the mapping out of the top-level component, à la
  `useChordChartSession`).
- **`MarkerControls`** grew a detection surface: « Détecter la structure »
  button (blocked+hint when the server is offline/checking, no grid needed),
  two-step « Remplacer les repères ? » confirm when markers already exist,
  per-code `ERROR_COPY`, and a `LiveStatus` announcement (Lot H a11y).
- **Shell wiring** — `structureDetector?` prop on `WorkstationShell`,
  `useStructureMarkers` threaded to `ShellMain` → `MarkerControls`
  (`blockedReason` from server health, `hasMarkers` arms the confirm).
- **Lingui** — all `structure.*` ids, French source catalog regenerated
  (`i18n:extract`), infinitive/nominal forms.

## Not done / remaining

- **S.3b — chart re-labeling** (deferred, product call): re-label the chord
  chart headers (`[Couplet]`/`[Refrain]`…) from the detected sections. Needs a
  **new core fold** (`DetectedSection[]` + grid → structured chart source,
  replacing `deduceStructure`'s uniform tiling), TDD in core. Pick up once the
  markers UX is validated in the browser.
- **Browser-verify** the real end-to-end (server up, real track) — the slice is
  covered by integration tests against a fake detector; a live run against the
  vendored SongFormer is the S.3b/close-out check.

## Decisions

- **S.3a markers-only for this PR** — the plan allows splitting markers (S.3a)
  from chart re-labeling (S.3b); markers are pure web decalque and shippable
  now, chart re-labeling is new core work. Confirmed with the product.
- **Detection replaces all markers** (guarded by the two-step confirm) —
  « detection owns the timeline ». A `kind`-typed marker (keep manual cues
  separate) can come later if the usage asks for it.
- **Raw labels at the adapter, translated at the UI** — the engine's vocabulary
  never reaches core; `section-label.ts` owns the FR mapping (Lingui).

## Review (high effort, 8 angles, verified)

- **No correctness bugs.** Two low/by-design notes: `setSections` wipes manual
  cue markers (documented intent, gated by the confirm); a sub-bar section that
  the core snap collapses can't produce duplicate markers (the collapse rule
  removes the section). Conventions + altitude clean.
- **1 cleanup applied**: `setSections` now takes the exported `SectionMarker`
  type instead of an inline shape (prevents S.3b drift). The chord↔structure
  hook duplication (jscpd-flagged) is consistent-by-design — a `useDetectionRun`
  helper would over-fit (5 hooks share the primitive, only this pair matches
  exactly); left as-is.

## Gate status

- typecheck ✅ · biome/sheriff ✅ · **tests 1236** (+29 vs S.2) with coverage ✅
  (`use-structure-detection` 100 % stmt / 92.3 % branch — the injected-default
  line is the only gap, same as the chord twin) · knip ✅ · jscpd ✅ (within
  budget) · react-doctor ✅ · tokens ✅
- Stryker **skipped** — core untouched this slice (web-only), per the O.3/P.4
  precedent.

## no-giant-component note

Adding the structure wiring tipped `WorkstationShell` from 299 → 308 lines
(react-doctor limit 300). Fixed with two genuine, behavior-preserving
extractions: `useStructureMarkers` (the section-marker mapping) and
`useFilePicker` (the hidden-input + label plumbing). Component back to 300.

## State to resume from

- **Single next action**: open + merge the S.3a PR (branch
  `feat/p-structure-web-s3`, incl. this report), then **browser-verify** the
  markers end-to-end and decide whether to start **S.3b** (chart re-labeling)
  or leave it in veille.
- Gotchas:
  - New Lingui copy needs `pnpm --filter @app/web i18n:extract` before specs
    resolve the ids via `i18n._` (the `.po` is the catalog).
  - `WorkstationShell` is at the 300-line react-doctor limit — the next shell
    touch needs another extraction.
