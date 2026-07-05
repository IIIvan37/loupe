import { describe, expect, it } from 'vitest'
import { pointerRatio } from './pointer-ratio.ts'

describe('pointerRatio', () => {
  const rect = { left: 100, width: 200 }

  it('maps a pointer inside the rail to its 0–1 position', () => {
    expect(pointerRatio(rect, 200)).toBe(0.5)
  })

  it('clamps a pointer before the start to 0', () => {
    expect(pointerRatio(rect, 50)).toBe(0)
  })

  it('clamps a pointer past the end to 1', () => {
    expect(pointerRatio(rect, 400)).toBe(1)
  })

  it('returns null when the rect is missing (element not mounted)', () => {
    expect(pointerRatio(undefined, 200)).toBeNull()
    expect(pointerRatio(null, 200)).toBeNull()
  })

  it('returns null for an unmeasurable (zero-width) rail', () => {
    expect(pointerRatio({ left: 0, width: 0 }, 10)).toBeNull()
  })
})
