# Session — 2026-07-02 — jalon3-project-ports

## Done

- **Slice J3.2 — the application layer of project persistence**, outside-in on
  branch `feat/jalon3-project-ports` (PR to open at close). The acceptance
  spec (`projects.spec.ts`, 13 tests, fake in-memory adapters) pulled into
  existence:
  - **`ProjectStore` port** — light manifests: `list` / `load` (undefined for
    an unknown id) / `save` / `delete`.
  - **`ProjectAudioStore` port** — heavy bytes: `put(bytes) → AudioRef` (the
    **store mints the ref**; its spelling is the adapter's business) and
    `get(ref)` (undefined for an unknown ref). Doc note: adapters should
    **content-address** refs so re-saves dedupe and orphaned blobs stay
    collectible — there is deliberately no `delete` on this port.
  - **`saveProject`** — puts source + stem bytes (in parallel), assembles the
    light `Project` via `projectFromSession`, saves the manifest. Re-saving an
    existing id is an update: `createdAt` survives, `updatedAt` = `stamp.now`.
    Rejects an inconsistent separation **before storing any byte**.
  - **`listProjects`** — manifests sorted most recently updated first.
  - **`openProject`** — manifest + every `AudioRef` resolved back to bytes
    (source + stems, fetched in parallel); unknown id / dangling ref → error.
  - **`deleteProject`** — manifest removal (consumes the port's `delete`).
  - All results are explicit `ok`/`error` unions (persistence errors are
    values, not exceptions — `loadTrack` precedent).
- **The mixer↔stems consistency invariant is now enforced** at its first
  consumer, per STATUS: new pure domain `mixerMatchesStems(stemIds, mixer)`
  (id-set equality, order-free) and `saveProject` fails fast on a mismatch.
- High-effort code review (8 finder angles + verify pass) → fixes applied:
  parallelised audio I/O (`Promise.all` for stem puts/gets + manifest load),
  `errorMessage` extracted to `application/error-message.ts` and reused by
  `loadTrack`/`separateTrack` (third inline copy removed), `toSorted` instead
  of spread-then-sort, content-addressing contract note on the port.
- Registry updated (`packages/core/src/application/README.md`): both ports +
  four use-cases; core `index.ts` exports the new surface (consumer: J3.3).

## Not done / remaining

- **No real adapter and no UI** — deliberate: J3.3 decides Tauri-FS vs HTTP
  server and wires Save / list / Open into the workstation. The fakes live in
  the spec only.
- **Orphaned blobs** (review findings, CONFIRMED but deferred by design): a
  failed save and every re-save strand previously-put blobs; the core records
  no superseded refs and the port has no delete. Mitigation chosen: the
  content-addressing recommendation on `ProjectAudioStore` (same bytes → same
  ref ⇒ re-saves dedupe; a manifest-scan GC can reclaim the rest). The J3.3
  adapter must honour it or accept the growth.
- `SaveProjectInput` only expresses audio as bytes — no "unchanged, reuse this
  ref" variant. Revisit at J3.3 if re-save cost shows up in practice (cheap
  API break: core is unreleased).
- Possible later unification: a shared `Result<T>` type for the six
  hand-rolled ok/error unions across use-cases (noted, not done — churn).
- Jalon 2 export (J2.6) still open and unblocked.

## Decisions

- **Store-minted `AudioRef`s** (`put(bytes) → ref`), not caller-minted — keeps
  the ref spelling entirely the adapter's business, consistent with the J3.1
  "opaque pointer" doc.
- **Mixer↔stems invariant enforced in `saveProject`** (fail-fast, before any
  I/O) via pure domain `mixerMatchesStems` — STATUS's "validate it here if a
  use-case needs it" is resolved: the first persisting consumer needs it.
- **Blob reclamation stays outside the hexagon**: no `delete` on
  `ProjectAudioStore`; adapters should content-address. Orphans are an
  adapter/GC concern, documented on the port.
- **`deleteProject` shipped with the port's `delete`** so no port member is
  speculative (its own use-case + tests; the J3.3 list UI is the next
  consumer).

## Gate status

- typecheck: ✅ (inside `pnpm gate`, exit 0)
- tests (with coverage): ✅ 291 passed (was 274; +17 for J3.2)
- mutation (Stryker, local): ✅ **96.26%** overall — application layer
  **100%** (`projects.ts`, `error-message.ts`, `load-track.ts`,
  `separate-track.ts`), domain `project.ts` **100%**
- biome / sheriff / knip / jscpd: ✅ all green (`pnpm gate` exit 0)

## State to resume from

- **Single next action**: open the PR for `feat/jalon3-project-ports`, then
  after merge start **J3.3** — the real adapter + UI (Save / list / Open),
  which **decides Tauri desktop vs extended HTTP server**. Start from the
  consumer: the workstation needs a Save action (assemble `SaveProjectInput`
  from the live session: source bytes are already in memory from `loadTrack`,
  stem WAVs re-encodable via `encodeWav`) and a project list/open screen
  driving `listProjects`/`openProject` (+ `deleteProject`).
- Gotchas / half-done edits: none — working tree clean, both commits on the
  branch (`d8fb5c7` feature, `1a76d3d` review fixes). When writing the J3.3
  adapter, honour the content-addressing recommendation on `ProjectAudioStore`
  (it is what keeps re-saves from duplicating multi-MB WAVs). `openProject`
  returns WAV/original **bytes** — the web side reuses `loadTrack`
  (decode + waveform + playback) and `decodeWav` for stems to rebuild the
  session.
