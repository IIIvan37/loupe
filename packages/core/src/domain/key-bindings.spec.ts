import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  defaultKeyBindings,
  type KeyBindings,
  resolveCommand
} from './key-bindings.ts'

describe('resolveCommand', () => {
  it('maps Space to toggling playback', () => {
    expect(resolveCommand(defaultKeyBindings, { code: 'Space' })).toEqual({
      type: 'togglePlayback'
    })
  })

  it('maps the arrows to a one-beat seek step', () => {
    expect(resolveCommand(defaultKeyBindings, { code: 'ArrowLeft' })).toEqual({
      type: 'seekStep',
      direction: -1,
      coarse: false
    })
    expect(resolveCommand(defaultKeyBindings, { code: 'ArrowRight' })).toEqual({
      type: 'seekStep',
      direction: 1,
      coarse: false
    })
  })

  it('maps Shift+arrows to a one-measure seek step', () => {
    expect(
      resolveCommand(defaultKeyBindings, { code: 'ArrowLeft', shift: true })
    ).toEqual({ type: 'seekStep', direction: -1, coarse: true })
    expect(
      resolveCommand(defaultKeyBindings, { code: 'ArrowRight', shift: true })
    ).toEqual({ type: 'seekStep', direction: 1, coarse: true })
  })

  it('maps the + / - characters to zoom in / out, whatever the layout', () => {
    expect(resolveCommand(defaultKeyBindings, { key: '+' })).toEqual({
      type: 'zoomIn'
    })
    expect(resolveCommand(defaultKeyBindings, { key: '-' })).toEqual({
      type: 'zoomOut'
    })
  })

  it('maps the M character to adding a marker', () => {
    expect(resolveCommand(defaultKeyBindings, { key: 'm' })).toEqual({
      type: 'addMarker'
    })
  })

  it('maps the practice-toggle characters to loop, metronome and tap tempo', () => {
    expect(resolveCommand(defaultKeyBindings, { key: 'l' })).toEqual({
      type: 'toggleLoop'
    })
    expect(resolveCommand(defaultKeyBindings, { key: 'k' })).toEqual({
      type: 'toggleMetronome'
    })
    expect(resolveCommand(defaultKeyBindings, { key: 't' })).toEqual({
      type: 'tapTempo'
    })
  })

  it('maps the [ / ] characters to stepping the tempo down / up', () => {
    expect(resolveCommand(defaultKeyBindings, { key: '[' })).toEqual({
      type: 'tempoStep',
      direction: -1
    })
    expect(resolveCommand(defaultKeyBindings, { key: ']' })).toEqual({
      type: 'tempoStep',
      direction: 1
    })
  })

  it('maps the { / } characters to stepping the pitch down / up', () => {
    // The shifted brackets — a distinct character, so a plain [ never fires
    // the pitch command by accident.
    expect(resolveCommand(defaultKeyBindings, { key: '{' })).toEqual({
      type: 'pitchStep',
      direction: -1
    })
    expect(resolveCommand(defaultKeyBindings, { key: '}' })).toEqual({
      type: 'pitchStep',
      direction: 1
    })
  })

  it('maps Shift+M to adding a SECTION marker', () => {
    // The hand-laid structure counterpart of M — same mnemonic, shifted.
    expect(
      resolveCommand(defaultKeyBindings, { key: 'M', shift: true })
    ).toEqual({ type: 'addSectionMarker' })
  })

  it('keeps an undeclared-shift character binding shift-agnostic', () => {
    // The '+' rationale: on many layouts the character itself needs Shift, so
    // a binding that says nothing about shift must keep matching either way.
    expect(
      resolveCommand(defaultKeyBindings, { key: 'L', shift: true })
    ).toEqual({ type: 'toggleLoop' })
  })

  it('matches a character binding regardless of the physical position', () => {
    // On AZERTY the physical `KeyM` key types ','; binding by character means
    // the user's actual `m` key adds the marker, wherever it sits.
    expect(
      resolveCommand(defaultKeyBindings, { key: 'm', code: 'Semicolon' })
    ).toEqual({ type: 'addMarker' })
  })

  it('leaves browser zoom (Ctrl/Cmd +) alone', () => {
    expect(
      resolveCommand(defaultKeyBindings, { key: '+', meta: true })
    ).toBeUndefined()
    expect(
      resolveCommand(defaultKeyBindings, { key: '+', ctrl: true })
    ).toBeUndefined()
  })

  it('maps Cmd+S to saving the project', () => {
    expect(
      resolveCommand(defaultKeyBindings, { key: 's', meta: true })
    ).toEqual({ type: 'saveProject' })
  })

  it('maps Ctrl+S to saving the project', () => {
    expect(
      resolveCommand(defaultKeyBindings, { key: 's', ctrl: true })
    ).toEqual({ type: 'saveProject' })
  })

  it('leaves a bare S unbound', () => {
    expect(resolveCommand(defaultKeyBindings, { key: 's' })).toBeUndefined()
  })

  it('returns undefined for an unbound key', () => {
    expect(resolveCommand(defaultKeyBindings, { code: 'KeyZ' })).toBeUndefined()
  })

  it.each(['shift', 'ctrl', 'alt', 'meta'] as const)(
    'does not fire a bare-key binding when %s is held',
    (modifier) => {
      // Any single modifier on a bare chord must reach the browser/OS instead.
      expect(
        resolveCommand(defaultKeyBindings, { code: 'Space', [modifier]: true })
      ).toBeUndefined()
    }
  )

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
