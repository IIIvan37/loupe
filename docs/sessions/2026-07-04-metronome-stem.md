# Session — 2026-07-04 — metronome-stem

## Done
- **The metronome as a configurable mixer stem** (user-requested follow-up to
  tempo detection). Once the tempo is known, a click track aligned to the
  detected beats (accented downbeats) rides the mixer like any separated stem —
  its own lane, colour, dB fader, mute/solo and WAV — and follows tempo/pitch on
  the shared master bus.
  - **Core (TDD)**: pure `synthesizeClickTrack(beats, durationSeconds,
    sampleRate)` → a mono click PCM (short decaying sine per beat, downbeats
    louder/higher, overlaps clamped). Mixer reducer gains `addChannel` /
    `removeChannel` (append a unity strip / drop one, others untouched). The
    `StemPlaybackEngine` port + web adapter gain `addStem` / `removeStem` (join a
    stem to the running mix at the live position / drop it). `buildStemTrack`
    exported so the web can summarise a synthetic stem.
  - **Web**: `buildMetronomeStem` + `buildTrackStem` (the whole track as one
    « Piste » stem, so an un-separated track can share the multitrack engine with
    the click); `useMetronome` seats the click — `enable` (un-separated:
    `[Piste, Métronome]`) or `attach` (joins a fresh separation:
    `[…stems, Métronome]`), each a **single** `mixer.load` so neither overwrites
    the other. `useMixer` gains `addStem` / `removeStem`.
  - **UX, iterated live with the user**:
    - **Automatic** — the tempo is detected on import (no button; a ref-held
      auto-detect effect keyed on `loadedAudio`), and the metronome stem shows
      **as soon as the tempo is known** (no toggle). `TempoPanel` is now a plain
      BPM read-out. The « Détecter » and « Recalculer » buttons were removed.
    - The **beat grid** overlay was toned right down (faint low-contrast lines)
      after « on ne voit que ça ».
    - The **mix view draws each voice in its own colour with transparency**
      (overlaid semi-transparent stem envelopes) instead of one amber envelope;
      the metronome got the amber accent, the un-split track teal.
  - **Persistence-safety**: the synthetic `metronome` / `piste` channels are
    filtered out of the mixer state a save persists and the session signature
    (they are re-synthesised, never stored).

## Fixes found while verifying in the browser (Chrome, live)
- **Separating hid the stems** — the separation handler did `mixer.load(stems)`
  then `metronome.enable`, but `enable` read a **stale** `separationActive` (the
  ref had not re-rendered) and reloaded `[Piste, Métronome]` over the stems.
  Fixed by splitting into `enable` (un-separated) vs `attach` (loads stems + click
  in one pass) — no stale read, no engine race. Locked by a shell test.
- **« Server offline » → no metronome**: the user's local server process had
  died, so tempo detection failed (no BPM → no stem). Not a code issue; the
  server was restarted (the browser reaches it once it is up).
- Clarified that the faint vertical lines in the mix are the **beat grid** (les
  temps), not the metronome audio; muting the click already drops it from the
  mix envelope (`combineWaveforms` weights by effective gain).
- Removed the now-dead `mixer.mixWaveform` (the combined envelope) — the mix is
  drawn as per-stem coloured layers.

## Not done / remaining
- **Persistence** (`ProjectTempo` + metronome on/off + its dB/mute): the analysis
  and the metronome are detect-on-demand and reset on track change, NOT saved.
  Reopening a project re-detects (server needed) rather than restoring. The next
  slice.
- The stem-engine `addStem` (used only by the un-separated → separate transition
  now that both paths do one `mixer.load`) stays for the port's completeness; a
  first-time `ensureStretch` concurrency edge is noted in the adapter.

## Decisions
- **Metronome is a first-class mixer stem**, not a bespoke player — it reuses the
  gain graph, lanes and headers, so mute/solo/fader/WAV all come for free and it
  slows with the track on the master bus.
- **Un-separated + metronome = « Piste » + « Métronome » two-lane mix** (the whole
  track becomes a stem) so the click has something to play against; chosen with
  the user over « metronome only once separated ».
- **Always shown once the tempo is known** (no toggle); to silence it, mute the
  lane like any stem.

## Gate status
- typecheck / biome / sheriff / impeccable / react-doctor / knip / jscpd: ✅
  (`pnpm gate` exit 0, also at pre-commit)
- tests (with coverage): ✅ **478 passed** (was 463 on the tempo branch; +15)
- mutation (Stryker, local): ✅ **94.22 %** overall; `mixer.ts` 95.51 %,
  `metronome.ts` 60.98 % — its survivors are **equivalent mutants** (defensive
  bounds guards on a `Float32Array`, which silently absorbs out-of-bounds writes,
  so removing them does not change the output); the observable behaviour (click
  placement, downbeat accent, silence) is covered.

## State to resume from
- **Single next action**: open the PR for `feat/metronome-stem` **stacked on
  `feat/tempo-detection` (PR #39)** — retarget to `main` once #39 merges.
- Gotchas: a local dev server (uvicorn on :8000, with `librosa` installed) and a
  Vite dev server (:5175) were left running for the browser verification. Tempo
  detection needs the server up + reachable (watch for `localhost` IPv4/IPv6 —
  point `VITE_SEPARATOR_URL` at `127.0.0.1:8000` if the browser can't reach it).
  The shell's default test detector never resolves, so auto-detect-on-import is
  inert unless a test injects one.
