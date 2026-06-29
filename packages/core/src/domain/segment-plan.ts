/**
 * Segmentation math for a fixed-window separator (e.g. htdemucs runs one
 * fixed-length 7.8 s segment per inference). Pure values-in/values-out so the
 * adapter's worker can chunk a long track and weighted-overlap-add the stems
 * back without any DSP knowledge leaking out of the core.
 */

/** One inference window: where it starts and how many real samples it covers. */
export interface Segment {
  readonly start: number
  /** Real (non-padded) samples this window covers; the adapter zero-pads the rest. */
  readonly length: number
}

/**
 * Tile `[0, totalSamples)` with overlapping fixed-length windows. Each window is
 * `segmentLength` long but the last one is truncated to what remains (the caller
 * zero-pads it back up). Consecutive windows step by `segmentLength - overlap`,
 * so a positive `overlap` guarantees gap-free coverage that the weighted
 * overlap-add then blends.
 */
export function planSegments(
  totalSamples: number,
  segmentLength: number,
  overlap: number
): readonly Segment[] {
  if (!Number.isInteger(segmentLength) || segmentLength < 1) {
    throw new Error('segment length must be a positive integer')
  }
  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= segmentLength) {
    throw new Error('overlap must be an integer in [0, segmentLength)')
  }
  const stride = segmentLength - overlap
  const segments: Segment[] = []
  for (let start = 0; start < totalSamples; start += stride) {
    segments.push({
      start,
      length: Math.min(segmentLength, totalSamples - start)
    })
  }
  return segments
}

/**
 * Plan up to `chunkCount` overlapping windows for data-parallel separation: each
 * window goes to its own worker, and consecutive windows overlap by `context` so
 * the weighted overlap-add can blend the seams. `chunkCount = 1` (or a short track)
 * yields a single full-length window — no seam. Thin wrapper over `planSegments`:
 * the stride is the per-worker share, the segment its share plus the shared context.
 */
export function planChunks(
  totalSamples: number,
  chunkCount: number,
  context: number
): readonly Segment[] {
  if (!Number.isInteger(chunkCount) || chunkCount < 1) {
    throw new Error('chunk count must be a positive integer')
  }
  if (!Number.isInteger(context) || context < 1) {
    throw new Error('context must be a positive integer')
  }
  const stride = Math.max(1, Math.ceil(totalSamples / chunkCount))
  return planSegments(totalSamples, stride + context, context)
}

/**
 * A strictly-positive trapezoidal window: it ramps linearly up over the first
 * `overlap` samples, sits flat across the middle, then ramps back down — peak
 * normalised to 1, edges never zero. Down-weighting each window's edges lets the
 * better-supported centre dominate where two windows overlap; the final divide
 * by the accumulated weight makes the blend a true weighted average.
 */
export function transitionWindow(
  segmentLength: number,
  overlap: number
): Float32Array {
  if (!Number.isInteger(segmentLength) || segmentLength < 1) {
    throw new Error('segment length must be a positive integer')
  }
  if (!Number.isInteger(overlap) || overlap < 1 || overlap > segmentLength) {
    throw new Error('overlap must be an integer in [1, segmentLength]')
  }
  const raw = new Array<number>(segmentLength)
  let peak = 1
  for (let i = 0; i < segmentLength; i++) {
    // Tent capped at `overlap`: rises 1..overlap, holds, falls overlap..1. The
    // `segmentLength - i` arm caps the rise when 2·overlap > segmentLength.
    const value = Math.min(i + 1, segmentLength - i, overlap)
    raw[i] = value
    if (value > peak) {
      peak = value
    }
  }
  return Float32Array.from(raw, (value) => value / peak)
}
