// Vendor the ONNX Runtime Web wasm binary into public/ort/ so the separator
// loads it from our own origin (local-first; nothing but the one-time model
// fetch leaves the machine). Only the single-threaded SIMD .wasm is needed — the
// JS glue is bundled into the worker, and `wasmPaths: { wasm }` (no prefix/.mjs
// override) keeps ORT from importing the glue from /public, which Vite forbids.
// Generated, never committed (see .gitignore); run from predev/prebuild.
import { createRequire } from 'node:module'
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
// Resolve the package's dist dir via its wasm entry, robust to pnpm's store.
const distDir = dirname(require.resolve('onnxruntime-web/wasm'))
const outDir = join(import.meta.dirname, '..', 'public', 'ort')

const files = ['ort-wasm-simd-threaded.wasm']

await mkdir(outDir, { recursive: true })
await Promise.all(
  files.map((file) => copyFile(join(distDir, file), join(outDir, file)))
)
console.log(`copied ${files.length} ORT wasm artifact(s) to ${outDir}`)
