#!/usr/bin/env bash
# Rebuild the demucs.cpp WebAssembly engine and vendor it into public/demucs/.
#
# Unlike the ORT wasm (regenerated from node_modules at predev), demucs.cpp has
# no npm/prebuilt distribution — it must be compiled from C++ with Emscripten. So
# the built artifacts (demucs.js + demucs.wasm, ~0.65 MB total) are COMMITTED under
# public/demucs/, and this script regenerates them. Run it only when bumping the
# engine; normal installs/deploys just use the committed files.
#
# Requires Docker (no local emsdk needed). Single-threaded SIMD build → no
# SharedArrayBuffer, so no COOP/COEP headers at runtime.
set -euo pipefail

# Pinned upstream — sevagh/demucs.cpp, the src_wasm build (libdemucs ABI:
# _modelInit(bytes) + _modelDemixSegment(L,R,len, 7×stereo stem ptrs, batch)).
REPO="https://github.com/sevagh/demucs.cpp.git"
COMMIT="f1206e9adeea103aef4a636b9e62297cf1f8e34e"
EMSDK_IMAGE="emscripten/emsdk:3.1.51"

here="$(cd "$(dirname "$0")/.." && pwd)"        # packages/web
# Docker (colima) only shares paths under $HOME — build there, not in /tmp.
work="$(mktemp -d "$HOME/demucs-build.XXXXXX")"
trap 'rm -rf "$work"' EXIT

git clone --recursive "$REPO" "$work/demucs.cpp"
git -C "$work/demucs.cpp" checkout "$COMMIT"
git -C "$work/demucs.cpp" submodule update --init --recursive

# Emit an ES module (export default libdemucs) so a Vite module worker can
# dynamic-import the glue — Vite dev does not bundle classic-worker imports.
sed -i.bak 's/-s MODULARIZE=1/-s MODULARIZE=1 -s EXPORT_ES6=1/' \
  "$work/demucs.cpp/src_wasm/CMakeLists.txt"

docker run --rm --platform linux/amd64 -v "$work/demucs.cpp":/src -w /src \
  "$EMSDK_IMAGE" bash -lc \
  'mkdir -p build-wasm && cd build-wasm && \
   emcmake cmake -DCMAKE_BUILD_TYPE=Release ../src_wasm && make -j4'

mkdir -p "$here/public/demucs"
cp "$work/demucs.cpp/build-wasm/demucs.js" "$work/demucs.cpp/build-wasm/demucs.wasm" \
  "$here/public/demucs/"
echo "Vendored demucs.js + demucs.wasm into $here/public/demucs/"
