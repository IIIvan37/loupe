---
name: next-step
description: Resume the work exactly where the last session left it — read STATUS.md and the newest session report, restate the next step in one line, state a scope contract, then execute it end to end (TDD → gate → commit). Use when the user says only « continuer », « next », « on continue », or invokes /next-step. Reads the plan; never guesses it.
---

# Next step (resume without guessing)

One responsibility: **turn a one-word resume into a deterministic pass**. The
plan already exists — `docs/STATUS.md` names the next action and the newest
report under `docs/sessions/` carries the state to resume from. This skill
reads them, contracts the scope out loud, then works. It invents no plan.

Never ask what to do next when STATUS answers it.

## 1. Read the plan (never the code first)

```
git branch --show-current
git status --short                    # uncommitted work = someone's half-done edits
git log --oneline main..HEAD
bash scripts/gate-stamp.sh check && echo "tree stamped green" || echo "not stamped"
ls -1 docs/sessions/ | tail -3        # the newest report, BY NAME (dates sort)
```

Then read `docs/STATUS.md` — « Next action » — and the newest report's « State
to resume from ». Those two say what the step is. Do not re-explore the code to
rediscover it.

**Stop and ask first** in these three cases, before touching anything:

- **The tree is dirty.** Uncommitted edits are someone's work in flight, not a
  finished step waiting to be committed. Check `ListAgents` for another session
  on this repo and ask it before you commit anything — a peer's `git commit`
  killed mid-hook leaves exactly this shape.
- **STATUS and the newest report disagree** on what comes next.
- **The named step is already done** in `git log`.

## 2. State the scope contract (2–4 lines, before any code)

Write it in the reply, not in a file:

- The one-line step, restated from STATUS.
- The files this will change.
- What is explicitly OUT — including anything another session owns.
- Anything destructive that needs approval (there should be nothing).

For a UI slice with a mockup or an interaction constraint, this is also where
the intended approach goes — CLAUDE.md asks for it, and it is where the
reworks come from.

## 3. Execute the step

`/tdd-cycle` for anything in `@app/core` or any pure logic: red first, and
**show the red output**. A test that passes the moment it is written proves
nothing — rewrite it.

For a refactor with no new behaviour, the guard is the existing suite plus the
ratchets. Prove it, don't assume it: **plant a defect in the new code, run the
targeted spec, show the failure, restore from a byte-for-byte copy**. If
nothing goes red, the code is uncovered — that is the finding, and it comes
before the commit.

## 4. Close

- `/quality-gate` — `pnpm gate` green and stamped, plus the close-step checks
  (`pnpm test:mutation:diff` when the step touched a mutated package,
  `pnpm sonar`). The gate is the judge; this skill is not.
- Commit, Conventional Commits, subject in lower case (commitlint rejects
  start-case). One commit per value.
- `/session-report` — the dated report plus STATUS rewritten, inside the
  feature's PR. Never a post-merge doc-only commit.

## What this skill does not do

- It does not verify. `/quality-gate` does.
- It does not write the report. `/session-report` does.
- It does not widen the step. Anything found on the way that is not the named
  step gets one line in the report's « Not done / remaining », not a fix.
