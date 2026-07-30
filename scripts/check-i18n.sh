#!/usr/bin/env bash
# Fail when the Lingui source catalog no longer matches the code — a message
# edited in a component but never re-extracted keeps shipping the OLD French
# string, and nothing else in the gate can see it (types, lint and tests all
# read the code, never the .po).
#
# The check IS the documented workflow: run `i18n:extract`, then look for a
# diff. Line numbers are off in lingui.config.ts (`formatter({lineNumbers:
# false})`), so a diff here means a message was added, changed, removed, or
# moved to another file — never just "code shifted down".
#
# On drift the freshly extracted catalog is LEFT IN PLACE: extract already did
# the work, so the fix is to review and stage it, not to run anything.
set -eu
cd "$(dirname "$0")/.."

catalogs=packages/web/src/locales

# Output kept back and replayed only on failure: a successful extract prints a
# stats table on stderr that would read as a warning inside a green gate.
if ! extract_log=$(pnpm -s --filter @app/web i18n:extract 2>&1); then
  printf '%s\n' "$extract_log" >&2
  echo "lingui extract failed — see above." >&2
  exit 1
fi

# Working tree vs index, so a catalog already staged by the caller counts as
# up to date (pre-commit runs this after the author staged their extract).
if ! git diff --quiet -- "$catalogs"; then
  echo "Lingui catalog out of date — UI copy changed without an extract." >&2
  echo "The catalog has just been re-extracted for you; review and stage it:" >&2
  echo >&2
  git --no-pager diff --stat -- "$catalogs" >&2
  echo >&2
  echo "  git add $catalogs" >&2
  exit 1
fi

echo "check:i18n ok — catalog in sync with the code"
