#!/usr/bin/env bash
# Freshness stamp for the quality gate, so a commit does not pay for it twice.
#
# The working method asks for `pnpm gate` before declaring anything done, and
# the pre-commit hook then replays the same checks — on a 2400-test suite with
# coverage that is the most expensive step of the loop, run twice on identical
# bytes. `pnpm gate` ends by stamping the exact working tree it validated;
# pre-commit skips the heavy checks when the tree still hashes to that stamp.
#
# The stamp is a real git tree hash of the whole working tree (tracked +
# untracked, .gitignore honoured), computed through a THROWAWAY index so the
# author's staged hunks are never touched. Content-addressed, so it cannot go
# stale: any byte that differs from what the gate saw yields another hash and
# the checks run in full. Edit-then-revert legitimately hits the stamp — the
# bytes are the ones that passed.
#
# Usage: gate-stamp.sh write | gate-stamp.sh check
set -eu
cd "$(dirname "$0")/.."

stamp_file="$(git rev-parse --git-dir)/loupe-gate-ok"

worktree_hash() {
  tmp_index=$(mktemp)
  # read-tree seeds it from HEAD so `add -A` only has to record differences.
  GIT_INDEX_FILE="$tmp_index" git read-tree HEAD
  GIT_INDEX_FILE="$tmp_index" git add -A
  GIT_INDEX_FILE="$tmp_index" git write-tree
  rm -f "$tmp_index"
}

case "${1:-}" in
  write)
    worktree_hash >"$stamp_file"
    echo "✅ gate ok — tree stamped ($(cut -c1-8 <"$stamp_file"))"
    ;;
  check)
    [ -f "$stamp_file" ] || exit 1
    [ "$(worktree_hash)" = "$(cat "$stamp_file")" ] || exit 1
    ;;
  *)
    echo "usage: gate-stamp.sh write|check" >&2
    exit 2
    ;;
esac
