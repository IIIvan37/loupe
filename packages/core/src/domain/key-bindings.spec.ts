import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  defaultKeyBindings,
  type KeyBindings,
  resolveCommand,
  SEEK_STEP_SECONDS
} from './key-bindings.ts'

describe('resolveCommand', () => {
  it('maps Space to toggling playback', () => {
    expect(resolveCommand(defaultKeyBindings, { code: 'Space' })).toEqual({
      type: 'togglePlayback'
    })
  })

  it('maps the arrows to a signed seek by SEEK_STEP_SECONDS', () => {
    expect(resolveCommand(defaultKeyBindings, { code: 'ArrowLeft' })).toEqual({
      type: 'seekBy',
      seconds: -SEEK_STEP_SECONDS
    })
    expect(resolveCommand(defaultKeyBindings, { code: 'ArrowRight' })).toEqual({
      type: 'seekBy',
      seconds: SEEK_STEP_SECONDS
    })
  })

  it('maps Equal / Minus to zoom in / out', () => {
    expect(resolveCommand(defaultKeyBindings, { code: 'Equal' })).toEqual({
      type: 'zoomIn'
    })
    expect(resolveCommand(defaultKeyBindings, { code: 'Minus' })).toEqual({
      type: 'zoomOut'
    })
  })

  it('maps M to adding a section marker', () => {
    expect(resolveCommand(defaultKeyBindings, { code: 'KeyM' })).toEqual({
      type: 'addMarker',
      kind: 'section'
    })
  })

  it('returns undefined for an unbound key', () => {
    expect(resolveCommand(defaultKeyBindings, { code: 'KeyZ' })).toBeUndefined()
  })

  it.each([
    'shift',
    'ctrl',
    'alt',
    'meta'
  ] as const)('does not fire a bare-key binding when %s is held', (modifier) => {
    // Any single modifier on a bare chord must reach the browser/OS instead.
    expect(
      resolveCommand(defaultKeyBindings, { code: 'Space', [modifier]: true })
    ).toBeUndefined()
  })

  it('treats absent and false modifiers as equivalent', () => {
    expect(
      resolveCommand(defaultKeyBindings, {
        code: 'Space',
        shift: false,
        ctrl: false,
        alt: false,
        meta: false
      })
    ).toEqual({ type: 'togglePlayback' })
  })

  it('requires an exact modifier match', () => {
    const bindings: KeyBindings = [
      {
        chord: { code: 'KeyK', shift: true },
        command: { type: 'togglePlayback' }
      }
    ]
    expect(resolveCommand(bindings, { code: 'KeyK', shift: true })).toEqual({
      type: 'togglePlayback'
    })
    expect(resolveCommand(bindings, { code: 'KeyK' })).toBeUndefined()
  })

  it('returns the first matching binding', () => {
    const bindings: KeyBindings = [
      { chord: { code: 'KeyA' }, command: { type: 'zoomIn' } },
      { chord: { code: 'KeyA' }, command: { type: 'zoomOut' } }
    ]
    expect(resolveCommand(bindings, { code: 'KeyA' })).toEqual({
      type: 'zoomIn'
    })
  })

  it('never resolves a chord whose code is bound to nothing', () => {
    const bound = new Set(
      defaultKeyBindings.map((binding) => binding.chord.code)
    )
    fc.assert(
      fc.property(fc.string(), (code) => {
        const command = resolveCommand(defaultKeyBindings, { code })
        if (command === undefined) {
          return
        }
        expect(bound.has(code)).toBe(true)
      })
    )
  })
})
