# Session — 2026-06-28 — session-wrap (Jalon 1, Slices 1→5)

Cross-cutting wrap-up for the session that drove Jalon 1 from the scaffold to a
working transcription player. Each slice has its own dated report; this one
records the session arc and two tooling findings that belong to no single slice.

## Done (all merged to `main`)

| PR | Slice | What shipped |
|----|-------|--------------|
| #6 | J1.1 | Import a local file → waveform (`loadTrack`, `Waveform`/`Track`, `WebAudioDecoder`, amber canvas) |
| #7 | J1.2 | Transport: play/pause/seek, playhead, click-seek, Space (`TransportState`, `formatTimecode`, `PlaybackEngine`/`WebAudioPlayback`) |
| #8 | J1.3 | Time-stretch + pitch (`clampPlaybackRate`/`clampPitchSemitones`, **SoundTouch** worklet) — browser-verified |
| #9 | J1.4 | Markers section/measure/beat (`Marker`/`MarkerList`, rail, click-seek) |
| #10 | J1.5 | A/B loops — the « loupe » (`LoopRegion`/`LoopLibrary` + `LoopStore` port + use-cases, drag-select, dim overlay, loop playback, persisted named loops) |

The app now: **import → waveform → transport → independent tempo/pitch → markers →
A/B looping**, 100 % client-side.

## Decisions resolved this session

- **Time-stretch engine: SoundTouch (MPL-2.0), not Rubber Band.** Rubber Band was
  confirmed GPL at Slice 3 start, but its only web wrapper (`rubberband-web`)
  crashes on live pitch change and is unmaintained — found by in-browser
  verification. SoundTouch fixes it **and lifts the GPL obligation** (product may
  ship under any licence). See [Slice 3 report](2026-06-28-jalon1-timestretch.md).

## Tooling findings (no single slice)

- **Extended gates run in CI + manual, not in pre-commit.** `pnpm gate` (the full
  gate, incl. `check:design` impeccable + `check:react` react-doctor +
  `test:coverage`) runs in CI on every PR and every push to `main`, and whenever
  `pnpm gate` is run locally (each slice close). The husky **pre-commit** runs a
  faster subset (`check:fix`, `typecheck`, `check:arch`, `test`, `check:dead`,
  `check:dup`) — it does **not** run design/react/coverage. Nothing broken reaches
  `main` (CI blocks PRs), but local commit-time feedback omits them. Decision: kept
  the pre-commit fast; enforcement stays in CI.
- **impeccable (`check:design`) has a narrow detector set.** Verified by smoke test
  (a planted CSS): it catches specific design "tells" (e.g. bounce/elastic easing)
  but **not** general "hardcoded hex vs token" lint. Zero findings so far = genuinely
  clean against its ruleset, not a misconfiguration. If raw-hex-vs-token
  enforcement is wanted, add a Biome/stylelint rule (not impeccable's job).

## Gate status (on `main`)

- typecheck ✅ · biome ✅ · sheriff ✅ · tests+coverage ✅ (104 passing) · knip ✅ ·
  jscpd ✅ · impeccable ✅ · react-doctor ✅.
- Mutation (core): last run at Slice 5 = **95.45%** (loops.ts 100%); no `@app/core`
  change since, so not re-run here.

## State to resume from

- **Single next action**: **Slice 6** — zoom + scrollable viewport (up to 6×):
  pure `Viewport` (time ↔ pixel mapping, round-trip property-tested) + zoom/scroll
  controls re-rendering the peaks; outside-in via `/new-feature-hexa`. Then **Slice
  7** — keyboard shortcuts (`KeyBindings` map) + a11y/responsive — closes Jalon 1.
- Open follow-ups carried forward: loops are global (not per-track); loop naming via
  `window.prompt`; saved loops not drawn on the timeline; marker labels can repeat
  after remove-then-add; a single shared `AudioContext` (decoder + playback create
  their own).
- Gotchas: commit subjects must start lowercase (commitlint `subject-case`); the
  SoundTouch/Web-Audio adapters are humble objects (untested in CI — verify audio in
  a browser).
