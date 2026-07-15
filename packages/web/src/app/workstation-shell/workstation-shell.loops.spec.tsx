// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { i18n } from '../../i18n/i18n.ts'
import {
  beatsAt,
  expectBpmReadout,
  importTrack,
  installShellHooks,
  openLoops,
  pointerGesture,
  renderShell,
  saveNamedLoop,
  savedLoop,
  waveformSurface
} from './shell-test-kit.tsx'

installShellHooks()

/** A detector answering a dense steady grid: 40 beats every 0.25 s (240 BPM). */
function steadyDetector() {
  const times = Array.from({ length: 40 }, (_, index) => index * 0.25)
  return { detect: async () => ({ bpm: 240, beats: beatsAt(times) }) }
}

describe('WorkstationShell loops & speed trainer', () => {
  it('drag-selects an A/B loop, names it via the editor, and recalls it', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    // The 20%→60% drag on a 10 s timeline saves the loop [2 s, 6 s].
    await saveNamedLoop(user, 'Mon passage')

    await openLoops(user)
    const recall = await screen.findByRole('button', { name: savedLoop('Mon passage') })
    await user.click(recall)
    expect(engine.seekTo).toHaveBeenCalledWith(2)
  })

  it('snaps a drag-selected loop to the detected beat grid', async () => {
    const { user } = renderShell({ tempoDetector: steadyDetector() })
    await importTrack(user)
    await expectBpmReadout(240)

    // The raw drag lands off-grid (2.1 s → 5.9 s); the loop must arm on the
    // nearest beats [2 s, 6 s] — its start handle sits at 20 % of the 10 s
    // timeline, not 21 %.
    pointerGesture(21, 59)
    const startHandle = screen.getByRole('button', {
      name: i18n._('waveform.move-loop-start')
    })
    expect(Number.parseFloat(startHandle.style.left)).toBeCloseTo(20)
  })

  it('holding Alt keeps the drag free of the grid (DAW escape)', async () => {
    const { user } = renderShell({ tempoDetector: steadyDetector() })
    await importTrack(user)
    await expectBpmReadout(240)

    pointerGesture(21, 59, { altKey: true })
    const startHandle = screen.getByRole('button', {
      name: i18n._('waveform.move-loop-start')
    })
    expect(Number.parseFloat(startHandle.style.left)).toBeCloseTo(21)
  })

  it('ramps the tempo as loop passes complete (speed trainer)', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)
    // Arm the loupe [2 s, 6 s]; the ramp form opens from the loop controls.
    pointerGesture(20, 60)

    await user.click(
      screen.getByRole('button', { name: i18n._('loops.trainer-open') })
    )
    await user.click(
      screen.getByRole('button', { name: i18n._('loops.trainer-start') })
    )

    // Arming seats the default start tempo (70 %) straight away.
    expect(engine.setTimeRatio).toHaveBeenCalledWith(0.7)
    expect(screen.getByText('70 %')).toBeInTheDocument()

    // Each completed pass (wrap at the loop end) earns the +5 % step.
    act(() => engine.emit(6.5))
    expect(engine.setTimeRatio).toHaveBeenCalledWith(0.75)
    expect(screen.getByText('75 %')).toBeInTheDocument()

    // Stopping restores the tempo the ramp armed over (100 %) and brings the
    // arm action back.
    await user.click(
      screen.getByRole('button', { name: i18n._('loops.trainer-stop') })
    )
    expect(
      screen.getByRole('button', { name: i18n._('loops.trainer-open') })
    ).toBeInTheDocument()
    expect(engine.setTimeRatio).toHaveBeenCalledWith(1)
    expect(screen.getByText('100 %')).toBeInTheDocument()
  })

  it('stops the ramp when the user takes the tempo back on the slider', async () => {
    const { user } = renderShell()
    await importTrack(user)
    pointerGesture(20, 60)
    await user.click(
      screen.getByRole('button', { name: i18n._('loops.trainer-open') })
    )
    await user.click(
      screen.getByRole('button', { name: i18n._('loops.trainer-start') })
    )
    expect(screen.getByText('70 %')).toBeInTheDocument()

    // Dragging the tempo slider is the user taking control back — the ramp
    // must not lie in the read-out nor snap the tempo down on the next wrap.
    fireEvent.change(
      screen.getByLabelText(i18n._('transport.tempo-slider')),
      { target: { value: '100' } }
    )

    expect(
      screen.queryByRole('button', { name: i18n._('loops.trainer-stop') })
    ).not.toBeInTheDocument()
    expect(screen.getByText('100 %')).toBeInTheDocument()
  })

  it('stops the ramp when looping is toggled off (no dead ramp)', async () => {
    const { user } = renderShell()
    await importTrack(user)
    pointerGesture(20, 60)
    await user.click(
      screen.getByRole('button', { name: i18n._('loops.trainer-open') })
    )
    await user.click(
      screen.getByRole('button', { name: i18n._('loops.trainer-start') })
    )

    // Play-through mode: no wrap can ever fire, so a « running » ramp would
    // be a lie. Turning looping off ends the practice and restores the tempo.
    await user.click(screen.getByRole('button', { name: i18n._('loops.active') }))

    expect(
      screen.queryByRole('button', { name: i18n._('loops.trainer-stop') })
    ).not.toBeInTheDocument()
    expect(screen.getByText('100 %')).toBeInTheDocument()
    // And the entry point is hidden while looping stays off.
    expect(
      screen.queryByRole('button', { name: i18n._('loops.trainer-open') })
    ).not.toBeInTheDocument()
  })

  it('stops the ramp when another passage becomes the loupe', async () => {
    const { user } = renderShell()
    await importTrack(user)
    pointerGesture(20, 60)
    await user.click(
      screen.getByRole('button', { name: i18n._('loops.trainer-open') })
    )
    await user.click(
      screen.getByRole('button', { name: i18n._('loops.trainer-start') })
    )
    expect(
      screen.getByRole('button', { name: i18n._('loops.trainer-stop') })
    ).toBeInTheDocument()

    // A fresh drag targets a different passage — the old ramp must not ride it.
    pointerGesture(10, 30)

    expect(
      screen.queryByRole('button', { name: i18n._('loops.trainer-stop') })
    ).not.toBeInTheDocument()
  })

  it('stops the ramp when a saved loop is recalled over it', async () => {
    const { user } = renderShell()
    await importTrack(user)
    await saveNamedLoop(user, 'Refrain')
    // Practise a different, throwaway passage.
    pointerGesture(10, 30)
    await user.click(
      screen.getByRole('button', { name: i18n._('loops.trainer-open') })
    )
    await user.click(
      screen.getByRole('button', { name: i18n._('loops.trainer-start') })
    )

    await openLoops(user)
    await user.click(
      await screen.findByRole('button', { name: savedLoop('Refrain') })
    )

    expect(
      screen.queryByRole('button', { name: i18n._('loops.trainer-stop') })
    ).not.toBeInTheDocument()
  })

  it('stops the ramp when the loupe is cleared', async () => {
    const { user } = renderShell()
    await importTrack(user)
    pointerGesture(20, 60)

    await user.click(
      screen.getByRole('button', { name: i18n._('loops.trainer-open') })
    )
    await user.click(
      screen.getByRole('button', { name: i18n._('loops.trainer-start') })
    )
    expect(
      screen.getByRole('button', { name: i18n._('loops.trainer-stop') })
    ).toBeInTheDocument()

    // Discarding the region ends the practice — there is nothing left to count.
    await user.click(
      screen.getByRole('button', { name: i18n._('loops.clear-region') })
    )
    expect(
      screen.queryByRole('button', { name: i18n._('loops.trainer-stop') })
    ).not.toBeInTheDocument()
  })

  it('edits a saved loop in place when its handle moves (no re-save prompt)', async () => {
    const { user } = renderShell()
    await importTrack(user)

    await saveNamedLoop(user, 'Pont')
    expect(
      screen.queryByRole('button', { name: i18n._('loops.save-region') })
    ).not.toBeInTheDocument()

    // Drag the end handle inward: the saved loop updates rather than spawning a
    // duplicate, so no « Enregistrer » reappears and there is still one chip.
    // Kept on fireEvent: coordinate-based drag needs explicit clientX values.
    const container = waveformSurface().parentElement as HTMLElement
    container.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect
    const endHandle = screen.getByRole('button', {
      name: i18n._('waveform.move-loop-end')
    })
    fireEvent.pointerDown(endHandle, { button: 0, clientX: 60 })
    fireEvent.pointerMove(endHandle, { clientX: 40 })
    fireEvent.pointerUp(container, { button: 0, clientX: 40 })

    expect(
      screen.queryByRole('button', { name: i18n._('loops.save-region') })
    ).not.toBeInTheDocument()
    await openLoops(user)
    expect(await screen.findAllByRole('button', { name: savedLoop('Pont') })).toHaveLength(1)
  })

  it('lets the region be saved again after its saved loop is removed', async () => {
    const { user } = renderShell()
    await importTrack(user)

    await saveNamedLoop(user, 'Refrain')
    // The region belongs to a saved loop now, so the save action is gone.
    expect(
      screen.queryByRole('button', { name: i18n._('loops.save-region') })
    ).not.toBeInTheDocument()

    // Removing that loop orphans the region — it must read as unsaved again.
    // Removal is a two-step confirm: arm, then confirm on the same button.
    await openLoops(user)
    await user.click(screen.getByRole('button', { name: i18n._('loops.remove-named', { name: 'Refrain' }) }))
    await user.click(screen.getByRole('button', { name: i18n._('loops.confirm-remove', { name: 'Refrain' }) }))

    expect(
      await screen.findByRole('button', { name: i18n._('loops.save-region') })
    ).toBeInTheDocument()
  })

  it('clears the saved loops when a new file is imported', async () => {
    const { user } = renderShell()
    await importTrack(user)

    await saveNamedLoop(user, 'Refrain')
    await openLoops(user)
    await screen.findByRole('button', { name: savedLoop('Refrain') })

    // A new track gets a fresh timeline — the old loops don't belong to it.
    await importTrack(user, 'autre.wav')

    expect(
      screen.queryByRole('button', { name: savedLoop('Refrain') })
    ).not.toBeInTheDocument()
  })

  it('wraps playback at the loop end only while looping is enabled', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    // Drag 20%→60% of a 10 s timeline → loop [2 s, 6 s], looping armed.
    pointerGesture(20, 60)
    act(() => engine.emit(6))
    expect(engine.seekTo).toHaveBeenLastCalledWith(2)

    // Turn looping off: the same overshoot must now play straight through.
    await user.click(screen.getByRole('button', { name: i18n._('loops.active') }))
    engine.seekTo.mockClear()
    act(() => engine.emit(7))
    expect(engine.seekTo).not.toHaveBeenCalled()
  })
})
