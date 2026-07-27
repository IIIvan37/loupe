#!/usr/bin/env bash
# Build the distributable `loupe` binary (distribution D4.b, route 2):
# web dist in server-shell mode → copied into the crate → release build with
# the dist embedded (rust-embed). One file, zero runtime, UI and server can
# never drift apart.
set -euo pipefail
cd "$(dirname "$0")/.."

VITE_SHELL=server pnpm --filter @app/web build

rm -rf crates/loupe-server/web_dist
cp -R packages/web/dist crates/loupe-server/web_dist

cargo build --release -p loupe-server
# `loupe` on unix, `loupe.exe` on windows (the release workflow runs this
# script on all three OS).
ls -lh target/release/loupe target/release/loupe.exe 2>/dev/null || true
