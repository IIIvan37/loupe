# STATUS

> Resumable source of truth. Updated at the end of each step via `/session-report`.

## Where we are

- **Phase**: Jalon 1 (« Transcribe! dans le navigateur ») — Slice 0 (web scaffold +
  extended gate) **done**, in PR. See [docs/jalon-1-plan.md](jalon-1-plan.md).
- **Branch**: `chore/jalon1-web-scaffold` (Slice 0 PR).
- **Packages**: `@app/core` (pure hexagon) + `@app/cli` (example adapter, to be
  removed once a real slice lands) + `packages/web` (scaffolded, gate-green).

## Locked decisions (kickoff)

- **Time-stretch engine**: Rubber Band → product is **GPL or commercial** (confirm
  before Slice 3).
- **Web stack**: React + Jotai · Base UI (headless) · Every Layout · CSS Modules +
  CSS-variable tokens · smart/dumb components.
- **Extra gates** (blocking, `packages/web` only): impeccable + react-doctor.
- **Per-slice loop**: `/new-feature-hexa` → `/tdd-cycle` → `pnpm gate` →
  `pnpm test:mutation` → **`/code-review`** → `/session-report` → PR.

## Next step

**Slice 1** — import a local file → render its waveform, outside-in via
`/new-feature-hexa`: `loadTrack` use-case (decode via an `AudioFileDecoder` port →
`Waveform` peaks → `Track`), then the `WebAudioDecoder` adapter + canvas renderer.
Re-add `@app/core` to `packages/web` when web first imports it.

## Roadmap

| Step | Description | Status |
|------|-------------|--------|
| 0 | Starter bootstrapped (monorepo, toolchain, guardrails, example slice) | ✅ |
| J1.0 | Scaffold `packages/web` (Vite+React+TS, tokens, Every Layout, Base UI, extended gate) | ✅ |
| J1.1 | Import local file → waveform | ⬜ |
| J1.2 | Transport: play/pause/seek + playhead + Space | ⬜ |
| J1.3 | Time-stretch + pitch (Rubber Band worklet) ⚠️ licence | ⬜ |
| J1.4 | Markers (section/measure/beat) | ⬜ |
| J1.5 | A/B loop drag-select + named loops (the « loupe ») | ⬜ |
| J1.6 | Zoom + scrollable viewport (6×) | ⬜ |
| J1.7 | Keyboard shortcuts | ⬜ |

## Session journal

Dated reports under [docs/sessions/](sessions/). Most recent on top.

- [2026-06-28 — jalon1-web-scaffold](sessions/2026-06-28-jalon1-web-scaffold.md) —
  Slice 0: `packages/web` scaffolded (Vite+React+Base UI+Every Layout+CSS Modules),
  gate extended (impeccable + react-doctor), kickoff decisions locked.
