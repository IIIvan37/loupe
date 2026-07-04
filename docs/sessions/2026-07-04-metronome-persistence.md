# Session — 2026-07-04 — metronome-persistence

## Done
- **The detected tempo + metronome now persist with the project** (the follow-up
  the metronome-stem slice flagged as « the next slice »). Reopening a saved
  project restores the beat grid, the BPM read-out and the metronome click
  **without hitting the server** — and the metronome starts **muted by default**
  on a fresh detection, unlike every other voice.
  - **Core (TDD)**: new pure `ProjectTempo` on `Project` / `SessionSnapshot`
    (`bpm` + downbeat-flagged `BeatGrid` + the metronome's `MixerChannel`
    settings), threaded through `projectFromSession` (omit-key guard like
    `tuning`/`activeLoop`) and `saveProject` (`SaveProjectInput.tempo`). The click
    PCM is never stored — it is re-synthesised from the grid + the re-imported
    audio. `project.ts` mutation 100 %.
  - **Web — save/restore**: `sessionSaveInput` threads the tempo; `restoreSession`
    now **owns** tempo + metronome seating on open — it suppresses the shell's
    auto-detect for the restored audio (a one-shot `setSuppressAutoDetect` flag),
    seats the analysis via a new `tempo.set` (no server), and seats the click in
    the right shape: `enable` (un-separated → `[Piste, Métronome]`) or `attach`
    (separated → `[…stems, Métronome]`), each a single `mixer.restore` with
    explicit per-channel settings. Old manifests (no persisted tempo) fall back to
    a **fire-and-forget** `tempo.detect` (never blocks the « ouverture » on the
    server) that seats a muted click when it lands.
  - **Web — muted default**: `DEFAULT_METRONOME_CHANNEL` (`{ muted: true }`) is
    the fresh-detection seat; `useMetronome.enable`/`attach` take explicit
    `MixerChannel` settings so the click lands at exactly the right mute/level in
    one pass (no second dispatch racing the load).
  - **Web — dirty flag**: `sessionSignature` signs the metronome's mixer settings
    with `?? DEFAULT_METRONOME_CHANNEL` as the neutraliser, so an absent tempo
    ≡ the default-muted click and a reopened project reads « Enregistré ». Only
    the metronome *settings* are signed — the grid/BPM are derived, never edited.
- **Browser-verified end-to-end** (Chrome, live server on `:8000` MPS + librosa,
  a synthetic 120 BPM click WAV):
  - Import → **120 BPM** auto-detected, `[Piste, Métronome]` mix, « Couper
    Métronome » **pressed (muted)** while « Piste » is not.
  - Unmute the click → save → the manifest holds `tempo.bpm ≈ 120`, a 23-beat
    grid, and `metronome { muted: false }`. Header reads « Enregistré ».
  - Reopen → **120 BPM restored**, the click restored **un-muted** (the saved
    value won over the default), « Enregistré » (not spuriously dirty).
  - Network trace: **exactly one `POST /tempo`** (the initial import). The reopen
    (`GET /projects/{id}` + `GET /audio/{ref}`) restores with **no second
    detection** — the whole point of the slice.

## Fixes from the high-effort review (8 angles → 4 findings, all addressed)
- **Phantom channels (regression I introduced)**: `onSeparate` built the
  `attach` base mixer from **all** `result.stems`; `mixer.restore` seats a channel
  per entry (unlike `mixer.load`, which filters `present`), so masked stems became
  phantom channels the save would persist and the signature would count — and the
  tempo vs no-tempo separation paths would then disagree. Fixed: `flatMap` over
  **present** stems only.
- **`liveSignature` asymmetry**: it keyed the metronome off a channel's presence
  while `handleSave` keys off `tempo.analysis`. Fixed: `liveSignature` now derives
  from `liveTempo()` — one predicate for « is there a metronome to sign/save ».
- **Separated + persisted tempo, rebuild fails**: if `separation.restore` returns
  `undefined`, the fast path seated a BPM over an empty mixer. Fixed: bail early
  (`if (separated && !restored) return`) — seat nothing rather than a contradiction.
- **Suppress latch on the superseded early-return**: `restoreSession` now clears
  the flag on `if (!audio) return`, so a superseding import still auto-detects
  (defensive; the `sessionEpoch` guard already blocked the reachable cases).

## Not done / remaining
- **Old separated manifests, within the detection window**: reopening a *pre-this-
  slice* separated project seats the stems immediately, then the fire-and-forget
  detect `attach`es them again with `saved.mixer` — reverting any fader/mute edit
  made in the ~seconds detection window. Very narrow (old manifests only) and
  **self-heals on save** (it becomes a new manifest = fast path, no detect). This
  slice already removes the bigger pre-existing bug in that path (auto-detect
  clobbering the restored stems). Documented, not fixed.
- `metronome.enabled` / `metronome.reset` remain (pre-existing, harmless) — left
  untouched to keep the slice focused.

## Decisions
- **`ProjectTempo` stores the grid, not just the BPM** — so a reopen
  re-synthesises the click with zero server round-trip; the server is only for the
  first detection (and old manifests).
- **The metronome is muted by default**, unlike other voices; persistence wins
  over the default (unmute + save → reopens un-muted).
- **Open owns tempo/metronome seating**; the shell auto-detect effect is
  import-only, gated by a one-shot suppress flag. This also fixes the latent
  open-path race where auto-detect could clobber restored stems.
- **Old manifests detect fire-and-forget** inside `restoreSession` — the
  « ouverture » state must never hang on the tempo server.

## Gate status
- typecheck: ✅
- tests (with coverage): ✅ **493 passed** (was 478; +15: core domain/app, metronome
  hook, session-signature, project-session round-trips, 3 shell round-trips)
- mutation (Stryker, local, core touched): ✅ **94.25 %** overall; `project.ts`
  **100 %**, `tempo.ts` 100 %, `detect-tempo.ts` 100 %. (`metronome.ts` 60.98 % is
  the pre-existing equivalent-mutant situation on defensive `Float32Array` bounds
  guards — untouched this slice.)
- biome / sheriff / knip / jscpd / impeccable / react-doctor: ✅ (`pnpm gate`
  exit 0)

## State to resume from
- **Single next action**: commit the report on `feat/metronome-persistence`, then
  `pnpm gate` → push → open the PR against `main`.
- Gotchas:
  - A local dev stack was left running for the browser-verify: the FastAPI server
    (`uvicorn` on `127.0.0.1:8000`, `LOUPE_DATA_DIR=separator-server/.loupe-data`,
    librosa installed) and the user's Vite dev server on `:5175`
    (`VITE_SEPARATOR_URL=http://127.0.0.1:8000`). The `.loupe-data/` dir is
    throwaway test data — do not commit it.
  - The shell's default test tempo detector never resolves, so `restoreSession`
    detecting an old manifest fire-and-forget is inert in tests unless a detector
    is injected (the old-manifest shell test injects a `vi.fn`).
