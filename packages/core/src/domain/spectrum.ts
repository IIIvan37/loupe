/**
 * A magnitude spectrum computed from raw samples — the paused-playback twin
 * of the live AnalyserNode tap. Values in, values out: a Hann-windowed
 * radix-2 FFT over one window of samples, folded to the analyser convention
 * (N/2 linear magnitudes, bin `i` centred on `i · sampleRate / N` Hz) so
 * `chromaFromSpectrum` consumes either source unchanged.
 */

interface SampleSpectrum {
  readonly magnitudes: Float32Array
  readonly sampleRate: number
}

export function spectrumFromSamples(
  samples: ArrayLike<number>,
  sampleRate: number
): SampleSpectrum {
  const n = samples.length
  if (n < 2 || (n & (n - 1)) !== 0) {
    throw new Error('the sample window length must be a power of two')
  }
  // Hann window: tames the leakage of a tone that doesn't land on a bin.
  const re = new Float32Array(n)
  const im = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)))
    re[i] = (samples[i] ?? 0) * hann
  }
  fftInPlace(re, im)
  // Linear magnitudes, scaled so a unit sine reads O(1) — the absolute scale
  // is irrelevant downstream (chroma normalises), the tests read amplitudes.
  const magnitudes = new Float32Array(n / 2)
  for (let i = 0; i < magnitudes.length; i++) {
    magnitudes[i] = (2 / n) * Math.hypot(re[i] ?? 0, im[i] ?? 0)
  }
  return { magnitudes, sampleRate }
}

/** Iterative radix-2 Cooley–Tukey, in place; length must be a power of two. */
function fftInPlace(re: Float32Array, im: Float32Array): void {
  const n = re.length
  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) {
      j ^= bit
    }
    j ^= bit
    if (i < j) {
      const tr = re[i] as number
      re[i] = re[j] as number
      re[j] = tr
      const ti = im[i] as number
      im[i] = im[j] as number
      im[j] = ti
    }
  }
  // Butterflies, doubling the transform length each pass.
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len
    const wRe = Math.cos(angle)
    const wIm = Math.sin(angle)
    for (let start = 0; start < n; start += len) {
      let curRe = 1
      let curIm = 0
      for (let k = 0; k < len / 2; k++) {
        const even = start + k
        const odd = start + k + len / 2
        const oddRe = (re[odd] as number) * curRe - (im[odd] as number) * curIm
        const oddIm = (re[odd] as number) * curIm + (im[odd] as number) * curRe
        re[odd] = (re[even] as number) - oddRe
        im[odd] = (im[even] as number) - oddIm
        re[even] = (re[even] as number) + oddRe
        im[even] = (im[even] as number) + oddIm
        const nextRe = curRe * wRe - curIm * wIm
        curIm = curRe * wIm + curIm * wRe
        curRe = nextRe
      }
    }
  }
}
