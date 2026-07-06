# Session — 2026-07-06 — web-complexity-debt-trio (E.2 / E.3 / E.4)

First half of **Lot E** (dette de complexité) from
[roadmap-excellence.md](../roadmap-excellence.md) — the three small,
behaviour-preserving items grouped into one PR. E.1 (the `use-player.ts` split)
follows as its own slice.

## Done
- **E.2 — shared « synthetic stem » predicate.** New
  [synthetic-stem.ts](../../packages/web/src/app/mixer/synthetic-stem.ts):
  `isSyntheticStem(id)` is the single source of truth for the two mixer channels
  that are **not** part of a saved separation — the always-on metronome
  (`METRONOME_ID`) and the whole-track « Piste » lane (`TRACK_STEM_ID`), both
  re-synthesised on open, never stored. `separationMixer()` in
  [use-project-session.ts](../../packages/web/src/app/workstation-shell/use-project-session.ts#L127)
  now filters on `!isSyntheticStem(channel.id)` instead of an inline dual-id
  comparison. Colocated spec (2 tests). NB: the duplication the roadmap flagged
  (use-project-session ↔ workstation-shell) had already been dissolved by prior
  slices — the two IDs are now compared per-id in `use-stem-export` /
  `use-separate-and-load` for genuinely distinct re-synthesis handling, so only
  the combined filter site was collapsed onto the predicate.
- **E.3 — lift `onSeparate` out of the JSX.** The inline arrow on `ShellMain`
  became a named `handleSeparate` handler on the shell
  ([workstation-shell.tsx](../../packages/web/src/app/workstation-shell/workstation-shell.tsx#L190)).
- **E.4 — drop the no-op** `.map((channels) => channels)` in
  [mixer.spec.ts](../../packages/core/src/domain/mixer.spec.ts#L24) (`stateArb`).

## Not done / remaining
- **E.1** — split [use-player.ts](../../packages/web/src/app/waveform/use-player.ts)
  (366 lines, 6 anti-stale refs, 5 responsibilities): extract the loop/wrap logic
  and the engine hand-off. **Next slice, its own branch/PR.**

## Decisions
- **E.2's scope was smaller than the roadmap assumed.** The named duplication was
  already gone; the honest cleanup is one canonical predicate + the one combined
  filter site, not a forced refactor of the per-id dispatch sites (which are not
  the same « is synthetic » question). Documented here so a future reader doesn't
  hunt for a duplication that no longer exists.

## Gate status
- typecheck: **green**
- tests (with coverage): **green — 587 passed**, coverage 95.76 % / 88.7 %
  (statements/branches), unchanged from D.3's baseline
- mutation (Stryker, local): **skipped** — core *production* code untouched (E.4
  edits a test file only); the two web helpers are outside the mutated scope
- biome / sheriff / knip / jscpd: **green** — sheriff clean, knip clean, **jscpd 5
  clones** (unchanged), react-doctor 0

## State to resume from
- **Single next action**: open the PR for `refactor/web-complexity-debt` (this
  report is the last commit), then start **E.1** on a fresh branch off `main`.
- Gotchas / half-done edits: none — working tree clean, gate green at commit
  `41f7ff0`.
