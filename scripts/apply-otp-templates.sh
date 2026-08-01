#!/usr/bin/env bash
# Re-apply the canonical OTP email templates (subjects + bodies) to the
# Supabase project (AW.3). The dashboard is NOT the source of truth —
# supabase/templates/otp-email.json is: `signInWithOtp` sends « Magic Link »
# to an existing user but « Confirm signup » to a new one, and a dashboard
# retouch that drops {{ .Token }} from either template silently turns the
# signup email link-only (the 2026-07-31 bug). After ANY template edit in the
# dashboard, restore the committed state with:
#   SUPABASE_ACCESS_TOKEN=<personal access token> ./scripts/apply-otp-templates.sh
# The Management API sits behind Cloudflare: curl works, python-urllib 403s.
set -euo pipefail
cd "$(dirname "$0")/.."

TEMPLATES=supabase/templates/otp-email.json
# The public project ref (Loupe, eu-north-1) — override for another project.
PROJECT_REF="${PROJECT_REF:-kqvpftctrkrtdwuvpnva}"
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN requis — personal access token (https://supabase.com/dashboard/account/tokens)}"

# Both templates must carry the OTP code — a token-less canonical file is
# exactly the regression this script exists to prevent.
tokens=$(grep -o '{{ .Token }}' "$TEMPLATES" | wc -l)
if [ "$tokens" -lt 2 ]; then
  echo "$TEMPLATES : {{ .Token }} doit apparaître dans les DEUX corps (trouvé : $tokens)" >&2
  exit 1
fi

response=$(mktemp)
trap 'rm -f "$response"' EXIT
status=$(curl -s -o "$response" -w '%{http_code}' \
  -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H 'content-type: application/json' \
  --data-binary "@$TEMPLATES")
if [ "$status" != 200 ]; then
  echo "PATCH config/auth : HTTP $status" >&2
  cat "$response" >&2
  exit 1
fi
echo "templates OTP posés sur $PROJECT_REF (magic link + confirm signup)"
