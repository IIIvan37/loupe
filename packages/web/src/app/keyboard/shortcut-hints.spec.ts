import { defaultKeyBindings, type KeyBindings } from '@app/core'
import { describeKeyBindings } from './shortcut-hints.ts'

describe('describeKeyBindings', () => {
  it('turns the shipped layout into readable French hints', () => {
    expect(describeKeyBindings(defaultKeyBindings)).toEqual([
      { keys: 'Espace', description: 'Lecture / Pause' },
      { keys: '←', description: 'Reculer de 5 s' },
      { keys: '→', description: 'Avancer de 5 s' },
      { keys: '+', description: 'Zoom avant' },
      { keys: '-', description: 'Zoom arrière' },
      { keys: 'M', description: 'Ajouter un repère' }
    ])
  })

  it('reflects the real seek delta rather than a hard-coded number', () => {
    const bindings: KeyBindings = [
      {
        chord: { code: 'ArrowRight' },
        command: { type: 'seekBy', seconds: 12 }
      }
    ]
    expect(describeKeyBindings(bindings)[0]).toEqual({
      keys: '→',
      description: 'Avancer de 12 s'
    })
  })

  it('renders a letter key from its physical code', () => {
    const bindings: KeyBindings = [
      { chord: { code: 'KeyK' }, command: { type: 'togglePlayback' } }
    ]
    expect(describeKeyBindings(bindings)[0]?.keys).toBe('K')
  })

  it('prefixes held modifiers in a stable order', () => {
    const bindings: KeyBindings = [
      {
        chord: { code: 'Equal', shift: true, meta: true },
        command: { type: 'zoomIn' }
      }
    ]
    expect(describeKeyBindings(bindings)[0]?.keys).toBe('⌘ + ⇧ + +')
  })
})
