#!/usr/bin/env bash
# Fail when a Sonar false-positive exemption points at a file that no longer
# exists — the exemption stops applying IN SILENCE and a finding everybody
# already decided about comes back as new.
#
# Not hypothetical: extracting the emergent core modules moved
# `domain/project.ts` and `domain/instrument-detection.ts` into their feature
# folders, and fp12/fp13 kept naming the flat paths. Both reappeared as open
# issues, with their documented rationale sitting three lines above the stale
# path in sonar-project.properties.
#
# Glob patterns are honoured; each one must still match at least one file.
set -eu
cd "$(dirname "$0")/.."

orphans=""
while IFS= read -r pattern; do
  # `find -path` matches the whole path, so a leading */ lets the bare-glob
  # patterns (**/*.spec.ts*) match at any depth.
  matches=$(find packages server supabase docs -path "$pattern" -o -path "*/$pattern" 2>/dev/null | head -1)
  [ -n "$matches" ] || orphans="$orphans  - $pattern"$'\n'
done < <(grep -oE '(^|\.)resourceKey=.*' sonar-project.properties | sed 's/.*resourceKey=//')

if [ -n "$orphans" ]; then
  echo "Sonar triage entries point at files that no longer exist:" >&2
  printf '%s' "$orphans" >&2
  echo "Each is a documented false positive whose exemption has silently stopped" >&2
  echo "applying. Repoint it in sonar-project.properties (or drop it if the" >&2
  echo "reason is gone) — don't let the finding come back as new." >&2
  exit 1
fi

echo "check:sonar ok — every triage entry still matches a file"
