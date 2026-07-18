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
        description: i18n._('shortcuts.seek-back')
      },
      {
        keys: '→',
        description: i18n._('shortcuts.seek-forward')
      },
      {
        keys: '⇧ + ←',
        description: i18n._('shortcuts.seek-back-bar')
      },
      {
        keys: '⇧ + →',
        description: i18n._('shortcuts.seek-forward-bar')
      },
      { keys: '+', description: i18n._('shortcuts.zoom-in') },
      { keys: '-', description: i18n._('shortcuts.zoom-out') },
      { keys: '⇧ + M', description: i18n._('shortcuts.add-section') },
      { keys: 'M', description: i18n._('shortcuts.add-marker') },
      { keys: 'L', description: i18n._('shortcuts.toggle-loop') },
      { keys: 'K', description: i18n._('shortcuts.toggle-metronome') },
      { keys: 'T', description: i18n._('tempo.tap') },
      { keys: '⌘ + S', description: i18n._('shortcuts.save-project') },
      { keys: '⌃ + S', description: i18n._('shortcuts.save-project') }
    ])
  })

  it('describes each seek step by its musical unit', () => {
    const bindings: KeyBindings = [
      {
        chord: { code: 'ArrowRight' },
        command: { type: 'seekStep', direction: 1, coarse: false }
      },
      {
        chord: { code: 'ArrowLeft', shift: true },
        command: { type: 'seekStep', direction: -1, coarse: true }
      }
    ]
    expect(describeKeyBindings(bindings)).toEqual([
      { keys: '→', description: i18n._('shortcuts.seek-forward') },
      { keys: '⇧ + ←', description: i18n._('shortcuts.seek-back-bar') }
    ])
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
