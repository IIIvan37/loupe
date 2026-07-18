// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { i18n } from '../../i18n/i18n.ts'
import {
  beatsAt,
  expectBpmReadout,
  fakeProjectStores,
  fakeStemEngine,
  importTrack,
  installShellHooks,
  pointerGesture,
  renderShell,
  saveProjectAs,
  tapThrice
} from './shell-test-kit.tsx'

installShellHooks()

describe('WorkstationShell keyboard shortcuts', () => {
  it('toggles playback with the Space key', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    fireEvent.keyDown(document.body, { code: 'Space' })
    expect(engine.play).toHaveBeenCalledOnce()
  })

  it('still fires shortcuts while a control button holds focus', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    // Importing leaves focus on the "Importer" button; Space must still toggle
    // playback rather than being swallowed as the button's own activation.
    const importButton = screen.getByRole('button', { name: i18n._('header.import') })
    importButton.focus()
    fireEvent.keyDown(importButton, { code: 'Space' })
    expect(engine.play).toHaveBeenCalledOnce()
  })

  it('does not fire shortcuts while typing in a text field', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    const input = document.createElement('input')
    document.body.appendChild(input)
    fireEvent.keyDown(input, { code: 'Space' })
    expect(engine.play).not.toHaveBeenCalled()
    input.remove()
  })

  it('ignores auto-repeated keydowns from a held key', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    // Holding a key must fire its command once, not at the OS repeat rate —
    // a held T would otherwise machine-gun tap-tempo into a bogus override.
    fireEvent.keyDown(document.body, { code: 'Space', repeat: true })
    expect(engine.play).not.toHaveBeenCalled()
  })

  it('stands back while a modal dialog is open', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    await user.click(
      screen.getByRole('button', { name: i18n._('header.show-shortcuts') })
    )
    const dialog = await screen.findByRole('dialog')
    // Focus is trapped inside the dialog, so the pressed key targets it; the
    // global layout must not mutate the session behind the overlay.
    fireEvent.keyDown(dialog, { code: 'Space' })
    expect(engine.play).not.toHaveBeenCalled()
  })

  it('ignores keyboard shortcuts until a track is loaded', () => {
    const { engine } = renderShell()
    fireEvent.keyDown(document.body, { code: 'Space' })
    expect(engine.play).not.toHaveBeenCalled()
  })

  it('seeks backward and forward with the arrow keys', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    act(() => engine.emit(5))
    fireEvent.keyDown(document.body, { code: 'ArrowRight' })
    // 5 s + 5 s step → 10 s (the timeline end).
    expect(engine.seekTo).toHaveBeenLastCalledWith(10)

    act(() => engine.emit(5))
    fireEvent.keyDown(document.body, { code: 'ArrowLeft' })
    expect(engine.seekTo).toHaveBeenLastCalledWith(0)
  })

  it('seeks by beat — and by measure with Shift — once a grid exists', async () => {
    const detector = {
      detect: async () => ({
        bpm: 120,
        beats: beatsAt([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5])
      })
    }
    // A resolved detection seats the metronome stem: seeks then flow through
    // the STEM engine (T.3 note), so that is the fake to interrogate.
    const stemEngine = fakeStemEngine()
    const { engine, user } = renderShell({
      tempoDetector: detector,
      stemEngine
    })
    await importTrack(user)
    await screen.findByRole('button', {
      name: i18n._('mixer.mute', { name: 'Métronome' })
    })

    act(() => engine.emit(1.1))
    fireEvent.keyDown(document.body, { code: 'ArrowRight' })
    expect(stemEngine.seekTo).toHaveBeenLastCalledWith(1.5)

    // Shift widens the step to the bar: the downbeats sit at 0 and 2 s.
    act(() => engine.emit(2.2))
    fireEvent.keyDown(document.body, { code: 'ArrowLeft', shiftKey: true })
    expect(stemEngine.seekTo).toHaveBeenLastCalledWith(2)
  })

  it('adds a marker at the playhead with the M key', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    act(() => engine.emit(5))
    // Bound by character ('m'), not physical position — works on any layout.
    fireEvent.keyDown(document.body, { key: 'm', code: 'Semicolon' })

    const goto = screen.getByRole('button', { name: i18n._('markers.go-to', { name: i18n._('markers.default-name', { number: 1 }) }) })
    await user.click(goto)
    expect(engine.seekTo).toHaveBeenLastCalledWith(5)
  })

  it('adds a SECTION marker at the playhead with Shift+M', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    act(() => engine.emit(5))
    // The shifted mnemonic of M — a hand-laid structure marker.
    fireEvent.keyDown(document.body, { key: 'M', code: 'Semicolon', shiftKey: true })

    const goto = screen.getByRole('button', {
      name: i18n._('markers.go-to', {
        name: i18n._('markers.default-section-name', { number: 1 })
      })
    })
    await user.click(goto)
    expect(engine.seekTo).toHaveBeenLastCalledWith(5)
  })

  it('toggles the loop with the L key', async () => {
    const { user } = renderShell()
    await importTrack(user)
    pointerGesture(20, 60)
    await screen.findByRole('button', { name: i18n._('loops.active') })

    fireEvent.keyDown(document.body, { key: 'l', code: 'KeyL' })
    expect(
      await screen.findByRole('button', { name: i18n._('loops.inactive') })
    ).toBeInTheDocument()

    fireEvent.keyDown(document.body, { key: 'l', code: 'KeyL' })
    expect(
      await screen.findByRole('button', { name: i18n._('loops.active') })
    ).toBeInTheDocument()
  })

  it('toggles the metronome mute with the K key', async () => {
    const detector = {
      detect: async () => ({ bpm: 120, beats: beatsAt([0, 0.5, 1]) })
    }
    const { user } = renderShell({ tempoDetector: detector })
    await importTrack(user)

    // The click seats muted by default; K makes it audible, K again mutes it.
    const mute = await screen.findByRole('button', {
      name: i18n._('mixer.mute', { name: 'Métronome' })
    })
    expect(mute).toHaveAttribute('aria-pressed', 'true')

    fireEvent.keyDown(document.body, { key: 'k', code: 'KeyK' })
    expect(mute).toHaveAttribute('aria-pressed', 'false')

    fireEvent.keyDown(document.body, { key: 'k', code: 'KeyK' })
    expect(mute).toHaveAttribute('aria-pressed', 'true')
  })

  it('taps a tempo with the T key', async () => {
    const detector = {
      detect: async () => {
        throw new Error('server unreachable')
      }
    }
    const { user } = renderShell({ tempoDetector: detector })
    await importTrack(user)
    await screen.findByRole('button', { name: i18n._('tempo.retry') })

    // Three T presses half a second apart — hands stay on the instrument.
    await tapThrice(() => {
      fireEvent.keyDown(document.body, { key: 't', code: 'KeyT' })
    })

    await expectBpmReadout(120)
    expect(screen.getByText(i18n._('tempo.manual-badge'))).toBeInTheDocument()
  })

  it('moves a marker with an arrow key on its tag', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    act(() => engine.emit(5))
    fireEvent.keyDown(document.body, { key: 'm', code: 'Semicolon' })

    const goto = screen.getByRole('button', { name: i18n._('markers.go-to', { name: i18n._('markers.default-name', { number: 1 }) }) })
    // One nudge is 1% of the 10 s timeline; clicking then seeks to 5.1 s.
    fireEvent.keyDown(goto, { key: 'ArrowRight' })
    await user.click(goto)
    expect(engine.seekTo).toHaveBeenLastCalledWith(expect.closeTo(5.1))
  })

  it('does not fire the global seek while an arrow key nudges a marker tag', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    act(() => engine.emit(5))
    fireEvent.keyDown(document.body, { key: 'm', code: 'Semicolon' })

    const goto = screen.getByRole('button', { name: i18n._('markers.go-to', { name: i18n._('markers.default-name', { number: 1 }) }) })
    engine.seekTo.mockClear()
    // The tag owns the arrow (it nudges the marker); the ←/→ seek shortcut
    // bound to the same physical key must stand back.
    fireEvent.keyDown(goto, { key: 'ArrowRight', code: 'ArrowRight' })
    expect(engine.seekTo).not.toHaveBeenCalled()
  })

  it('renames a marker from the inspector', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    act(() => engine.emit(5))
    fireEvent.keyDown(document.body, { key: 'm', code: 'Semicolon' })

    await user.click(screen.getByRole('button', { name: i18n._('markers.rename-named', { name: i18n._('markers.default-name', { number: 1 }) }) }))
    await user.clear(screen.getByLabelText(i18n._('common.name')))
    await user.type(screen.getByLabelText(i18n._('common.name')), 'Pont')
    await user.click(screen.getByRole('button', { name: i18n._('common.rename') }))

    // The rail tag follows the new label; the old one is gone.
    expect(
      screen.getByRole('button', { name: i18n._('markers.go-to', { name: 'Pont' }) })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: i18n._('markers.go-to', { name: i18n._('markers.default-name', { number: 1 }) }) })
    ).not.toBeInTheDocument()
  })

  it('zooms with the + and - characters, regardless of layout', async () => {
    const { user } = renderShell()
    await importTrack(user)

    const slider = screen.getByLabelText(
      "Zoom de la forme d'onde"
    ) as HTMLInputElement
    const level = () => Number(slider.value)

    expect(level()).toBe(1)
    fireEvent.keyDown(document.body, { key: '+', code: 'Equal' })
    expect(level()).toBeGreaterThan(1)

    const zoomedIn = level()
    fireEvent.keyDown(document.body, { key: '-', code: 'Minus' })
    expect(level()).toBeLessThan(zoomedIn)
  })

  it('leaves browser/OS chords alone (modified keys are not bound)', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    fireEvent.keyDown(document.body, { code: 'Space', metaKey: true })
    expect(engine.play).not.toHaveBeenCalled()
  })

  it('saves the session as a project with Cmd+S', async () => {
    // A fake store so the save never touches the real HTTP store (which would
    // fetch localhost:8000 and fail whenever the audio server is off).
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)

    fireEvent.keyDown(document.body, { key: 's', metaKey: true })
    // The header flips to its « project exists » face once the save lands.
    expect(
      await screen.findByRole('button', {
        name: i18n._('header.rename-project')
      })
    ).toBeInTheDocument()
  })

  it('re-saves a dirty project under its own name with Ctrl+S', async () => {
    const stores = fakeProjectStores()
    const save = vi.spyOn(stores.store, 'save')
    const { user, engine } = renderShell({ projectStores: stores })
    await importTrack(user)
    await saveProjectAs(user, 'Mon projet')
    // Dirty the session: drop a marker at the playhead.
    act(() => engine.emit(2))
    fireEvent.keyDown(document.body, { key: 'm' })

    fireEvent.keyDown(document.body, { key: 's', ctrlKey: true })
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(save.mock.lastCall?.[0].name).toBe('Mon projet')
  })

  it('does not re-save a clean project on Cmd+S', async () => {
    const stores = fakeProjectStores()
    const save = vi.spyOn(stores.store, 'save')
    const { user } = renderShell({ projectStores: stores })
    await importTrack(user)
    await saveProjectAs(user, 'Mon projet')

    fireEvent.keyDown(document.body, { key: 's', metaKey: true })
    // Nothing changed since the save — the chord must not re-encode the session.
    await act(async () => {})
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('saves with Cmd+S even while typing in a text field', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)

    const input = document.createElement('input')
    document.body.appendChild(input)
    fireEvent.keyDown(input, { key: 's', metaKey: true })
    expect(
      await screen.findByRole('button', {
        name: i18n._('header.rename-project')
      })
    ).toBeInTheDocument()
    input.remove()
  })
})
