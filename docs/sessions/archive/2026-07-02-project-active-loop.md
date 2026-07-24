# Session — 2026-07-02 — project-active-loop

## Done
- **User-reported bug: « la loop n'est pas récupérée à la réouverture d'un
  projet ». Root-caused, reproduced, fixed, browser-verified.**
- **Diagnosis** (in the real app, real server, real manifest):
  - Named loops (the library) were saved AND restored correctly all along —
    proven by a new shell integration test and a live round-trip.
  - The user's actual manifest (`the-cure-lullaby…`) showed `loops: []` with
    markers present: their loop was the **armed A/B region — the loupe
    itself** — which was **absent from the `Project` model entirely**. Never
    saved, never re-armed. Even a named loop came back only as a chip, not as
    the armed region.
- **Fix**: the loupe is now part of the project.
  - Core: `ProjectActiveLoop { region, enabled }` on `Project` +
    `SessionSnapshot` (optional, key omitted when absent);
    `projectFromSession` carries it; `saveProject` persists it
    (`SaveProjectInput.activeLoop`).
  - Web: the save snapshot includes the current `loopRegion` + `loopEnabled`;
    `restoreSession` re-arms it on open via `usePlayer.restoreLoop` (region +
    wrap choice together, bypassing the fresh-selection re-arm heuristic) and
    **relinks** it to the saved loop it came from when the region matches one
    exactly (`useLoopEditing.restore`) — so handle edits keep updating that
    loop and no duplicate « Enregistrer la boucle » is offered.
- Tests: 3 shell integration tests written RED first (region restored; wrap
  choice off preserved; relink = no duplicate save), 3 `restoreSession` unit
  tests (relink id / null / absent), core domain + use-case tests. Plus the
  session's earlier gap-filler: the named-loops round-trip test.
- **Browser-verified end-to-end** (real server): drag region → save → reload
  → open → « ⟳ Boucle active » armed with its handles. Test projects cleaned.

## Not done / remaining
- Existing manifests saved before this fix simply have no `activeLoop` — they
  open fine, without an armed region (correct degradation, no migration).
- Tempo/pitch/zoom persistence remains a separate backlog item (same family:
  session state not yet in the manifest — see the post-mortem note below).

## Decisions
- **The loupe needs no name to be worth persisting**: an armed A/B region is
  the product's core object; « save the project » must keep it. Modelled as
  optional `ProjectActiveLoop`, distinct from the named-loop library.
- **Relink by exact region equality** (floats survive the JSON round-trip
  unchanged) rather than persisting a loop id — no new identity to keep
  consistent.
- **Process (post-mortem)**: the miss was a *model* gap, not a code bug —
  every layer faithfully saved what `SessionSnapshot` contained, and all
  tests asserted the plumbing, none asserted the *user's* invariant
  (« ce que je vois se rouvre »). Guard going forward: when a slice claims
  « X is persisted », the shell-level round-trip test must enumerate the
  **visible session state** (region armed, toggle state…), not just the data
  that happens to be in the snapshot; and browser-verify the user journey,
  not the endpoints.

## Gate status
- typecheck: ✅ (gate green end-to-end)
- tests (with coverage): ✅ 390 passed (48 files)
- mutation (Stryker, local): ✅ 95.83 % overall; `project.ts` 100 %,
  `projects.ts` 96.34 % (3 pre-existing equivalent mutants on the
  `separation` guard; the redundant `activeLoop` guard was removed instead of
  left as an unkillable mutant)
- biome / sheriff / knip / jscpd / impeccable / react-doctor: ✅

## State to resume from
- **Single next action**: merge PR #32 (J2.6 export), then the stacked
  `fix/project-keeps-active-loop` PR (based on the export branch), in order.
- Gotchas:
  - `usePlayer.setLoopRegion` re-enables looping when arming a fresh region;
    `restoreLoop` exists precisely to bypass that heuristic on restore.
  - The header « Exporter » button is still the disabled « Bientôt » stub —
    spotted during browser-verify; wire it to the J2.6 zip export (or drop
    it for the mixer button) in a small follow-up.
  - Old manifests without `activeLoop` are valid; no migration needed.
