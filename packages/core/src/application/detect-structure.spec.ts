import { describe, expect, it, vi } from 'vitest'
import type { DetectedSection } from '../domain/song-structure.ts'
import type { BeatGrid } from '../domain/tempo.ts'
import { detectStructure, StructureDetectionError } from './detect-structure.ts'
import type { DecodedAudio, StructureDetector } from './ports.ts'

const audio: DecodedAudio = {
  sampleRate: 48000,
  channels: [new Float32Array(48000)]
}

/** A 4/4 grid: `bars` downbeats `barSeconds` apart, off-beats between. */
function grid(bars: number, barSeconds: number): BeatGrid {
  const beats = []
  for (let bar = 0; bar < bars; bar++) {
    for (let beat = 0; beat < 4; beat++) {
      beats.push({
        timeSeconds: bar * barSeconds + (beat * barSeconds) / 4,
        downbeat: beat === 0
      })
    }
  }
  return beats
}

function detectorReturning(
  sections: readonly DetectedSection[]
): StructureDetector {
  return { detect: vi.fn().mockResolvedValue(sections) }
}

describe('detectStructure', () => {
  it('snaps the detected sections onto the beat grid', async () => {
    const detector = detectorReturning([
      { startSeconds: 0, endSeconds: 8.06, label: 'intro' },
      { startSeconds: 8.06, endSeconds: 16, label: 'verse' }
    ])
    const result = await detectStructure(
      { audio, grid: grid(9, 2) },
      { detector }
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      // snapped from 8.06 onto the downbeat at 8, boundary shared
      expect(result.sections.map((s) => s.endSeconds)[0]).toBe(8)
      expect(result.sections.map((s) => s.startSeconds)[1]).toBe(8)
    }
  })

  it('passes the audio and abort signal to the detector', async () => {
    const detector = detectorReturning([
      { startSeconds: 0, endSeconds: 8, label: 'verse' }
    ])
    const controller = new AbortController()
    await detectStructure(
      { audio, grid: grid(5, 2), signal: controller.signal },
      { detector }
    )
    expect(detector.detect).toHaveBeenCalledWith(audio, controller.signal)
  })

  it('works without a grid — sections pass through unsnapped (marker-only run)', async () => {
    // The « detect structure » button places markers even before a chord grid
    // exists; no downbeats just means no snapping.
    const detector = detectorReturning([
      { startSeconds: 0, endSeconds: 8.06, label: 'intro' }
    ])
    const result = await detectStructure({ audio, grid: [] }, { detector })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.sections.map((s) => s.endSeconds)).toEqual([8.06])
    }
  })

  it('rejects a detection with no sections — nothing to mark', async () => {
    const result = await detectStructure(
      { audio, grid: grid(5, 2) },
      { detector: detectorReturning([]) }
    )
    expect(result).toEqual({
      ok: false,
      code: 'no-structure',
      detail: 'no structure detected'
    })
  })

  it('rejects non-finite times rather than emitting a broken section', async () => {
    const result = await detectStructure(
      { audio, grid: grid(5, 2) },
      {
        detector: detectorReturning([
          { startSeconds: 0, endSeconds: Number.NaN, label: 'verse' }
        ])
      }
    )
    expect(result).toEqual({
      ok: false,
      code: 'unknown',
      detail: 'invalid structure detection'
    })
  })

  it('the typed detector error is a named StructureDetectionError', () => {
    const err = new StructureDetectionError('timeout', 'slow')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('StructureDetectionError')
    expect(err.code).toBe('timeout')
  })

  it('forwards a typed detector failure code', async () => {
    const detector: StructureDetector = {
      detect: vi
        .fn()
        .mockRejectedValue(
          new StructureDetectionError('engine-unavailable', 'no model')
        )
    }
    const result = await detectStructure(
      { audio, grid: grid(5, 2) },
      { detector }
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('engine-unavailable')
    }
  })

  it('folds an unexpected throw into unknown', async () => {
    const detector: StructureDetector = {
      detect: vi.fn().mockRejectedValue(new Error('boom'))
    }
    const result = await detectStructure(
      { audio, grid: grid(5, 2) },
      { detector }
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('unknown')
    }
  })
})
