#!/usr/bin/env bash
# Fail when a CSS var() references a token defined nowhere — a dead token
# silently falls back to `inherit`/initial (e.g. an error line losing its
# danger colour). Definitions live in CSS custom properties or in inline
# styles ('--x': …) set from TS/TSX.
set -eu
cd "$(dirname "$0")/.."
src=packages/web/src
# `|| true`: a grep with zero matches is a valid (empty) side of the diff,
# not a failure.
used=$({ grep -rhoE 'var\(--[a-z0-9-]+' --include='*.css' "$src" || true; } | sed 's/var(//' | sort -u)
defined=$({
  grep -rhoE '^[[:space:]]*--[a-z0-9-]+[[:space:]]*:' --include='*.css' "$src" || true
  grep -rhoE "'--[a-z0-9-]+':" --include='*.ts' --include='*.tsx' "$src" || true
} | tr -d " \t:'" | sort -u)
undefined=$(comm -23 <(printf '%s\n' "$used") <(printf '%s\n' "$defined"))
if [ -n "$undefined" ]; then
  echo "CSS tokens used but never defined:" >&2
  printf '%s\n' "$undefined" >&2
  exit 1
fi

# Absolute font-size literals (rem/px) belong on the type scale in tokens.css —
# a literal in a module is scale drift. Relative `em` ratios stay legal: they
# size against their local context (superscripts, icon-to-text), not the scale.
drift=$(grep -rnE 'font-size:[[:space:]]*[0-9.]+(rem|px)' --include='*.css' "$src" | grep -v 'styles/tokens.css' || true)
if [ -n "$drift" ]; then
  echo "font-size literals outside tokens.css (use a --font-size-* token):" >&2
  printf '%s\n' "$drift" >&2
  exit 1
fi
# CSS-module classes referenced from TS/TSX must exist in the imported file —
# `styles.missing` silently renders className={undefined} (no error anywhere).
# Import lines are excluded from the usage scan: `from './x.module.css'` would
# read as a use of `x.module`.
missing_classes=""
while IFS= read -r ts; do
  dir=$(dirname "$ts")
  while IFS=$'\t' read -r name rel; do
    css="$dir/$rel"
    [ -f "$css" ] || continue
    defined=$({ grep -oE '(^|[[:space:],])\.[A-Za-z][A-Za-z0-9_-]*' "$css" || true; } | sed 's/.*\.//' | sort -u)
    used=$({ grep -v '^import ' "$ts" | grep -oE "\b$name\.[A-Za-z0-9_]+" || true; } | sed "s/^$name\.//" | sort -u)
    [ -n "$used" ] || continue
    ghosts=$(comm -23 <(printf '%s\n' "$used") <(printf '%s\n' "$defined"))
    if [ -n "$ghosts" ]; then
      missing_classes="$missing_classes$ts -> $rel: $(printf '%s' "$ghosts" | tr '\n' ' ')"$'\n'
    fi
  done < <(grep -oE "import [A-Za-z0-9_]+ from '[^']+\.module\.css'" "$ts" | sed -E "s/import ([A-Za-z0-9_]+) from '([^']+)'/\1\t\2/")
done < <(grep -rlE "\.module\.css'" "$src" --include='*.tsx' --include='*.ts')
if [ -n "$missing_classes" ]; then
  echo "CSS-module classes referenced but never defined:" >&2
  printf '%s' "$missing_classes" >&2
  exit 1
fi

echo "check:tokens ok — every var(--…) defined, no font-size drift, no ghost class"
