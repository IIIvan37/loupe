#!/usr/bin/env sh
# PreToolUse(Bash) guard: one heavy run at a time.
#
# Stryker forks a worker per core and re-runs the suite per mutant. Overlapping
# it with `pnpm gate` or a full suite starves the CPU and the specs fail on
# CONTENTION — a red that looks like a regression and costs a debug loop to
# dismiss. CLAUDE.md states the rule; this enforces it.
#
# Deliberately narrow: only mutation-vs-suite overlap is refused. A long-lived
# `test:watch` is idle between edits, so it never blocks a gate — a guard that
# fires on the normal setup would just be disabled.
#
# Reads the hook payload (JSON) on stdin; exit 2 blocks the tool and feeds the
# stderr message back to Claude. No jq/node dependency.

payload=$(cat)

case "$payload" in
  *stryker* | *test:mutation*) launching=mutation ;;
  *"pnpm gate"* | *test:coverage* | *"vitest run"*) launching=suite ;;
  *) exit 0 ;;
esac

# Patterns are anchored on a path separator so they match the RUNNING BINARY
# (`node …/vitest/vitest.mjs run`, `node_modules/.bin/stryker`) and not a mere
# mention of the word — a commit message or a grep argument would otherwise
# lock the repo out of its own test suite. The bracket keeps pgrep from
# matching the pattern's own command line.
running() { pgrep -f "$1" >/dev/null 2>&1; }

refuse() {
  echo "Refused: $1 is already running — one heavy run at a time." >&2
  echo "Stryker and a full suite fight over the CPU; the loser fails on timeouts," >&2
  echo "not on a real defect (see CLAUDE.md, 'never overlap Stryker with gate')." >&2
  echo "Wait for it to finish, then re-run this command." >&2
  exit 2
}

if [ "$launching" = mutation ]; then
  running '/[s]tryker' && refuse "a mutation run"
  running '/[v]itest' && refuse "a test suite"
fi

if [ "$launching" = suite ]; then
  running '/[s]tryker' && refuse "a mutation run"
fi

exit 0
