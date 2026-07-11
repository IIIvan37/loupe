# Session — 2026-07-11 — stems-memory (Lot L.3)

## Done
- **The stem engine is now the ONLY custodian of the separated stems' PCM.**
  Before: `useSeparation` retained the `Float32Array` sources in React state
  AND the engine held a full `AudioBuffer` copy — ~2 × 500 MB on a six-stem
  track. After: only the engine's buffers remain; everything JS-side re-derives
  from them zero-copy.
- **Port** (`packages/core/src/application/ports.ts`): `StemPlaybackEngine`
  gains `stemAudio(id): DecodedAudio | undefined` — read one loaded stem's PCM
  back as views into the engine's buffers. `load`'s doc now states the timing
  contract: `stemAudio` must serve every loaded id from the moment the call is
  handed over (callers release their copy right after calling).
- **Engine** (`web-audio-stem-playback.ts`): `load` adopts the buffers
  **synchronously** (before awaiting worklet registration) so the contract
  holds with no empty window; gain wiring moved after the await, guarded by a
  `loadToken`. `stemAudio` uses the shared `decodedAudioFrom(buffer)`
  (extracted to `web-audio-shared.ts`, also reused by the file decoder).
- **`useSeparation(pcmOf, separator?, archive?)`**: retains only
  `Pick<SeparatedStem, 'id' | 'label'>` descriptors; `sources` is a **lazy
  getter** deriving from `pcmOf` at access time (all consumers are event
  handlers — save, export, metronome attach). A stem whose PCM the engine no
  longer holds is omitted (spec'd). TDD: 2 new specs (engine-identity
  derivation, missing-PCM drop), 966 tests total.
- **`useMixer`**: `mixable` keeps display `StemTrack`s only — the PCM pairs
  stay local to `adopt` and die once `engine.load` copied them.
- **Transient copy fix** (`audioBufferFrom`): `Float32Array` channels are
  passed to `copyToChannel` as-is instead of via `Float32Array.from` (which
  copied tens of MB per stem for nothing).
- **/code-review (8 angles + verify) applied 3 correctness fixes**:
  1. *Ghost stem*: `addStem`'s post-await tail now bails when the stem left
     `stems` (a `removeStem`/reseat or a wholesale load raced the worklet
     registration) — it would have wired and started a source nothing could
     ever stop.
  2. *`ensureStretch` re-entrancy* (`web-audio-shared.ts`): concurrent
     cold-start callers now share one registration promise (two SoundTouch
     nodes both wired to the destination would split the mix across two
     buses); params re-applied after the await.
  3. *Stale faders*: `desiredGains` is cleared at each `load` — a new track's
     same-named stems (voix, batterie…) inherited the previous project's
     gains while the mixer showed unity (pre-existing bug).
  Plus cleanups: lazy `sources` (was rebuilt per render), stable
  `stemPlayback.stemAudio` ref, `Pick<>` descriptor, `stemById` Map in the
  channels memo, `decodedAudioFrom` extraction.
- **Browser-verified** on the real « show must go on » project (5 stems +
  métronome): restore → playback advances; per-stem WAV download is real audio
  (44 MB, peaks ~9 000 across the track); save → reload → reopen round-trips
  all six lanes; **JS heap settles at 559 MB** (vs ~1.05–1.4 GB with the double
  retention). `react-doctor` `async-defer-await` suppressed for
  `web-audio-stem-playback.ts` (false positive: the post-await guards check
  state that *changes during* the await).

## Not done / remaining
- **Accepted limitation (cold start only)**: play() pressed inside the
  first-load worklet-registration window (~100–500 ms) starts the clock with
  gains not yet wired — silence, then the audio joins in sync. Previously the
  press was a silent no-op. Deeper fix filed: a permanent master input bus
  wired at construction (SoundTouch spliced in when ready) would make
  load/addStem fully synchronous and delete the `loadToken` + the doctor
  override.
- **Pre-existing, unchanged**: if the engine loses a ready stem's PCM (the
  fire-and-forget detect race already in veille can reload the engine with
  piste+click), save/export proceed with the partial set silently — same
  outcome as before this lot (`mixedStems` already intersected with the
  replaced mixer channels), but now the PCM is also gone. Bites only via that
  race; fix alongside the veille entry if it ever does.
- The old-manifest restore path retains the decodeWav'd PCM in the
  `seatMetronome` closure until the tempo detect resolves (slow server =
  transiently doubled memory on that path only).
- The mix (un-separated track) still lives twice — shell `DecodedAudio` +
  single-track engine buffer; L.4 (WAV memoization) touches the adjacent
  encode path, not this.
- Four hand-rolled `StemPlaybackEngine` fakes across specs had to grow
  `stemAudio`; a shared `fakeStemPlaybackEngine()` helper would pay off at the
  next port change.

## Decisions
- **Custody = the playback engine.** Rejected alternatives: aliasing
  `getChannelData` storage back into the retained sources (spec's
  acquire-the-content rules make it browser-dependent), or a separate PCM
  store (a third owner to keep in sync).
- `sources` stays a `readonly SeparatedStem[]` property (lazy getter), so no
  consumer changed shape — save/export/metronome code is untouched.
- `stemAudio` lives on the core port, matching the established pattern (no
  core use-case drives `play()` either — engine ports describe the adapter
  contract the hooks consume).

## Gate status
- typecheck: ✅ (gate exit 0)
- tests (with coverage): ✅ 966 tests, 86 files
- mutation (Stryker, core touched — port type only): ✅ **94,91 %** (≥ 80)
- biome / sheriff / knip / jscpd / react-doctor / impeccable: ✅ (one new
  file-scoped `async-defer-await` suppression, justified above)

## State to resume from
- **Single next action**: open/merge the L.3 PR, then **L.4** (memoize the
  encoded WAV per `DecodedAudio` for `/tempo`, `/chords`, `/separate` —
  `WeakMap<DecodedAudio, Uint8Array>` shared by the three adapters), then
  M (sécurité serveur).
- Gotchas: the `stemAudio` timing contract is documented on the port — any
  future engine implementation must adopt buffers before its first await in
  `load`. The jsdom fakes emulate it with a `Map` (see
  `workstation-shell.spec.tsx`). Untracked junk at repo root
  (`doctor.config.json`, a chart PDF) is still not part of any step.
