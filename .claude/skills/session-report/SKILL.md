---
name: session-report
description: Close a work step with a resumable session report. Use at the end of every step/PR so a fresh session can pick up exactly where this one left off. Updates the canonical docs/STATUS.md and appends a dated report under docs/sessions/.
---

# Session report (close a work step)

Produce the artifacts that let a new session resume with zero context loss. Run
this at the end of each step/PR, before stopping.

## 1. Gather the real state (don't guess)

```
date +%F                       # the report's date / filename prefix
git branch --show-current
git status --short
```

Then run the quality gate and record the result:

- `pnpm gate` (typecheck + biome + arch + design + react + tests with coverage
  + knip + jscpd).
- **Mutation testing locally (Stryker).** If the step touched `@app/core` (the
  mutated scope), run `pnpm test:mutation` and report the score in the gate
  section. The CI post-merge run is a backstop, not the gate — surviving mutants
  must be caught **before** the PR, while the code is fresh. Skip only when the
  step touched no mutated package (say so).
- Don't fabricate a green check — report failures honestly.
- **Module watch** (rule of three): does a prefix/concept now appear >= 3 times
  in the flat `core/src/domain`? does a use-case + port serve a single cluster?
  If yes, note it under "Decisions" as a pending extraction — or extract before
  closing (`/new-feature-hexa` 4bis). (`pnpm modules:hint` will point at
  candidates once lot TS.5 lands.)

## 2. Append a dated session report

- Copy `docs/sessions/_TEMPLATE.md` to `docs/sessions/<YYYY-MM-DD>-<slug>.md`
  (slug = the step). Never overwrite an existing report — history is append-only.
- Fill every section honestly: Done, Not done / remaining, Decisions, Gate status
  (with the results from step 1), State to resume from.
- "State to resume from" must name the SINGLE next action and any gotchas /
  half-done edits.
- **Decisions is a log, not an explanation.** If the step changed a boundary, an
  invariant or the toolchain, write the reasoning once as an ADR under
  `docs/adr/` (once lot TS.3 sets the practice up) and link it from this
  section. Never restate the why in both places — a report is read to resume,
  an ADR is read months later by someone about to undo the constraint. Most
  steps need no ADR.

## 3. Roll the window

`docs/sessions/` keeps only the recent reports scannable. If the folder grows
past ~5 active reports, `git mv` the oldest into `docs/sessions/archive/`
(create it on first use). Nothing is deleted — the working set just stays
scannable.

## 4. Update the canonical STATUS — on `main`, after the merge

`docs/STATUS.md` is a **snapshot of the present, not a log**: only the current
step detailed, one "Historique" line per past step (detail lives in
`docs/sessions/`). Rewrite it, don't append:

- **Where we are** — phase, step, packages. Replace the old text.
- **Next action** — the SINGLE next thing. Replace it.
- **Write it merge-invariantly.** Name the step and its PR ("step N, delivered
  by PR #NN" is true before and after the merge), never the feature branch or
  the PR's lifecycle state. Only the dated report keeps pre-merge phrasing (it
  describes a past).
- **Open questions** — only what is genuinely undecided; delete each one when
  resolved.

**Loupe convention**: STATUS (and the roadmap Suivi) stay OUT of feature
branches — they are a conflict magnet across parallel slices. Update them on
`main` via a doc-only commit **after** the merge. Only the dated report ships
inside the PR.

## 5. Keep memory in sync (optional, if the plan shifted)

If a durable cross-session decision changed (an invariant, a resolved open
question, a scope change), capture it. Don't duplicate the whole report — just the
durable decision.

## 6. Commit the report on the feature branch — BEFORE the PR

The dated report describes the work the PR contains, so it ships **inside** the
PR — never as a separate post-merge commit.

- Commit it on the **feature branch**, before `gh pr create`. Order per feature:
  feature commits → this report commit → `pnpm gate` → push → open PR → merge.
- Phrase the **dated report** for the **pre-merge** state ("PR #N opened",
  branch still current) — not as if it were already merged. STATUS is the
  opposite (see step 4): merge-invariant, updated on `main` after the merge.
- The doc-only-direct-to-`main` exception (see the `block-commit-on-main` hook)
  covers the post-merge STATUS update and any **standalone** report not tied to
  a code PR; a report that accompanies code goes in that code's PR.

## Output

End with a 3-line summary to the user: what's done, the next action, and the
report path.
