# Session — 2026-07-02 — jalon2-export-verify

## Done
- **PR #34 (`feat/ux-session-state`) merged** and `main` synced; the merged
  branch deleted locally + remotely.
- **`HEAD /audio/{ref}` confirmed live** on the running server (probe returns
  404 for an unknown ref, not 405) — no restart needed, incremental save is
  fully active.
- **J2.6 export browser-verified on a real separation** (the last pending
  Jalon 2 item). Real MP3 (The Cure – Lullaby, 4:19) → Demucs `htdemucs_6s`
  on MPS → header « Exporter » → zip inspected:
  - flat root, exactly `01_Voix.wav … 05_Autres.wav` — numbered, zero-padded,
    **present stems only** (« Claviers » not detected → excluded);
  - all five WAVs exactly 11 456 000 frames (259.773 s, stéréo 44.1 kHz
    Int16) — aligned by construction, byte-identical sizes;
  - `05_Autres.wav` spot-RMS of 0 investigated: real sparse audio (peak
    0.24 FS, ~155 s audible), not an empty stem;
  - probes: « Exporter » disabled before stems and **re-disabled after a new
    import** (the stale-export review fix holds); second separation + export
    → identical structure (WAV CRCs differ only because Demucs/MPS is not
    bit-deterministic across runs); zero console errors/warnings.
- **Jalon 2 is closed** — all its slices are merged and browser-verified.

## Not done / remaining
- **Export blocks the main thread** (~229 MB encode+zip): a few seconds of
  frozen UI on click, no busy indicator on the button. Confirmed noticeable
  on a 4-min track — the already-deferred « off-thread zip/encode » item now
  has a measured user impact.
- Zip-name sanitisation only exercised on a safe title in the browser
  (unit-covered otherwise).
- One-off, **not reproduced**: after the first export click an armed A/B
  loop (~1:37–2:55) appeared without a deliberate drag; a controlled retry
  (separate → no loop → export → still no loop) points to an accidental
  automation drag, not the app. Keep in mind if a user reports a
  « phantom loop ».
- Transient: mid-decode of a new import, the previous track's loop bar stays
  visible until decode completes (reset is decode-anchored). Harmless.

## Decisions
- No new decisions — this step executed the plan (merge → probe → verify).
  Jalon 2 formally closes; next work comes from the UX backlog / Jalon 3
  polish already listed in STATUS.

## Gate status
- typecheck: ✅ (gate green end-to-end on `main`)
- tests (with coverage): ✅ 404 passed (49 files)
- mutation (Stryker, local, if core touched): skipped — no code touched this
  step (verification only; last run 95.83 %)
- biome / sheriff / knip / jscpd: ✅

## State to resume from
- **Single next action**: pick the next slice from the backlog — candidates:
  uniform dirty-session guard on import/reload, real tempo detection,
  tempo/pitch/zoom persistence, speed trainer, undo; or Jalon 3 polish
  (project rename, blob GC, `separator-server/` → `server/`). The measured
  main-thread export freeze also makes « off-thread zip/encode » a fair
  candidate.
- Gotchas / half-done edits: none — working tree clean, `main` green. The
  local server already serves `HEAD /audio/{ref}`; don't ask the user to
  restart it again.
