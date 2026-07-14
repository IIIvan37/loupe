import { defaultKeyBindings, type KeyBindings } from '@app/core'
import { i18n } from '../../i18n/i18n.ts'
import { describeKeyBindings } from './shortcut-hints.ts'

describe('describeKeyBindings', () => {
  it('turns the shipped layout into readable localized hints', () => {
    expect(describeKeyBindings(defaultKeyBindings)).toEqual([
      {
        keys: i18n._('shortcuts.key-space'),
        description: i18n._('shortcuts.play-pause')
      },
      {
        keys: '←',
        description: i18n._('shortcuts.seek-back', { seconds: 5 })
      },
      {
        keys: '→',
        description: i18n._('shortcuts.seek-forward', { seconds: 5 })
      },
      { keys: '+', description: i18n._('shortcuts.zoom-in') },
      { keys: '-', description: i18n._('shortcuts.zoom-out') },
      { keys: '⇧ + M', description: i18n._('shortcuts.add-section') },
      { keys: 'M', description: i18n._('shortcuts.add-marker') },
      { keys: 'L', description: i18n._('shortcuts.toggle-loop') },
      { keys: 'K', description: i18n._('shortcuts.toggle-metronome') },
      { keys: 'T', description: i18n._('tempo.tap') }
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
      description: i18n._('shortcuts.seek-forward', { seconds: 12 })
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
