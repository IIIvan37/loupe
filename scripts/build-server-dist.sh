#!/usr/bin/env bash
# Build the distributable `loupe` wheel (distribution D3, route 1):
# web dist in server-shell mode → copied into the package → wheel.
# The wheel is self-contained: `uvx --from <wheel> loupe` serves its own UI.
set -euo pipefail
cd "$(dirname "$0")/.."

VITE_SHELL=server pnpm --filter @app/web build

rm -rf server/app/web_dist
cp -R packages/web/dist server/app/web_dist

(cd server && uv build --wheel)
ls -lh server/dist/*.whl | tail -1
