// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { i18n } from '../../i18n/i18n.ts'
import {
  importTrack,
  installShellHooks,
  pointerGesture,
  renderShell
} from './shell-test-kit.tsx'

installShellHooks()

describe('WorkstationShell transport & markers', () => {
  it('disables play until a track is loaded, then enables it with the duration', async () => {
    const { container, user } = renderShell()

    expect(screen.getByRole('button', { name: i18n._('transport.play') })).toBeDisabled()

    await importTrack(user)

    expect(screen.getByRole('button', { name: i18n._('transport.play') })).toBeEnabled()
    // Scope to the transport — the ruler also prints timecodes.
    const footer = container.querySelector('footer') as HTMLElement
    expect(within(footer).getByText('0:10')).toBeInTheDocument()
  })

  it('plays and pauses via the transport button, driving the engine', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    await user.click(screen.getByRole('button', { name: i18n._('transport.play') }))
    expect(engine.play).toHaveBeenCalledOnce()

    const pauseButton = screen.getByRole('button', { name: i18n._('transport.pause') })
    await user.click(pauseButton)
    expect(engine.pause).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: i18n._('transport.play') })).toBeInTheDocument()
  })

  it('jumps to the start and end of the timeline via the transport buttons', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)
    act(() => engine.emit(5))

    await user.click(screen.getByRole('button', { name: i18n._('transport.end') }))
    expect(engine.seekTo).toHaveBeenLastCalledWith(10)

    await user.click(screen.getByRole('button', { name: i18n._('transport.start') }))
    expect(engine.seekTo).toHaveBeenLastCalledWith(0)
  })

  it('reflects the engine position as a timecode', async () => {
    const { engine, container, user } = renderShell()
    await importTrack(user)

    act(() => engine.emit(5))
    const footer = container.querySelector('footer') as HTMLElement
    expect(within(footer).getByText('0:05')).toBeInTheDocument()
  })

  it('drives the engine tempo from the tempo slider', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    // Range slider: user-event cannot drive <input type="range">.
    fireEvent.change(screen.getByLabelText(i18n._('transport.tempo-slider')), {
      target: { value: '75' }
    })
    // 75 % → ratio 0.75.
    expect(engine.setTimeRatio).toHaveBeenCalledWith(0.75)
  })

  it('drives the engine pitch from the pitch slider', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    // Range slider: user-event cannot drive <input type="range">.
    fireEvent.change(screen.getByLabelText(i18n._('transport.pitch-slider')), {
      target: { value: '5' }
    })
    expect(engine.setPitchSemitones).toHaveBeenCalledWith(5)
  })

  it('steps the speed with the pill ± buttons', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    await user.click(
      screen.getByRole('button', { name: i18n._('transport.tempo-up') })
    )
    // 100 % + one 5 % grain → 105 % → ratio 1.05.
    expect(engine.setTimeRatio).toHaveBeenLastCalledWith(1.05)

    await user.click(
      screen.getByRole('button', { name: i18n._('transport.tempo-down') })
    )
    expect(engine.setTimeRatio).toHaveBeenLastCalledWith(1)
  })

  it('steps the pitch with the pill ± buttons', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    await user.click(
      screen.getByRole('button', { name: i18n._('transport.pitch-up') })
    )
    expect(engine.setPitchSemitones).toHaveBeenLastCalledWith(1)
  })

  it('edits the speed by typing into the read-out field', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    const field = screen.getByLabelText(i18n._('transport.tempo-field'))
    await user.clear(field)
    await user.type(field, '80')
    await user.tab()
    expect(engine.setTimeRatio).toHaveBeenLastCalledWith(0.8)
  })

  it('returns the speed to 100 % on a double-click of the slider', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    fireEvent.change(screen.getByLabelText(i18n._('transport.tempo-slider')), {
      target: { value: '60' }
    })
    fireEvent.doubleClick(
      screen.getByLabelText(i18n._('transport.tempo-slider'))
    )
    expect(engine.setTimeRatio).toHaveBeenLastCalledWith(1)
  })

  it('drives the engine a fractional pitch from the fine-tune field', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    const field = screen.getByLabelText(i18n._('transport.fine-tune-field'))
    await user.clear(field)
    await user.type(field, '30')
    await user.tab()
    // +30 cents = +0.3 semitone — SoundTouch takes the fraction directly.
    expect(engine.setPitchSemitones).toHaveBeenLastCalledWith(0.3)
  })

  it('combines the semitone slider and the fine-tune into one engine pitch', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    const field = screen.getByLabelText(i18n._('transport.fine-tune-field'))
    await user.clear(field)
    await user.type(field, '-20')
    await user.tab()
    fireEvent.change(screen.getByLabelText(i18n._('transport.pitch-slider')), {
      target: { value: '5' }
    })
    expect(engine.setPitchSemitones).toHaveBeenLastCalledWith(4.8)
  })

  it('flags a fine-tune beyond ±50 cents while it is typed', async () => {
    const { user } = renderShell()
    await importTrack(user)

    const field = screen.getByLabelText(i18n._('transport.fine-tune-field'))
    await user.clear(field)
    await user.type(field, '80')
    expect(field).toHaveAttribute('aria-invalid', 'true')
  })

  it('disables the tempo and pitch sliders until a track is loaded', () => {
    renderShell()
    expect(screen.getByLabelText(i18n._('transport.tempo-slider'))).toBeDisabled()
    expect(screen.getByLabelText(i18n._('transport.pitch-slider'))).toBeDisabled()
  })

  it('adds a marker at the playhead and seeks back to it', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    act(() => engine.emit(5))
    await user.click(screen.getByRole('button', { name: i18n._('markers.add') }))

    const goto = screen.getByRole('button', { name: i18n._('markers.go-to', { name: i18n._('markers.default-name', { number: 1 }) }) })
    await user.click(goto)
    expect(engine.seekTo).toHaveBeenCalledWith(5)

    // Removal is a two-step confirm: arm, then confirm on the same button.
    await user.click(screen.getByRole('button', { name: i18n._('markers.remove-named', { name: i18n._('markers.default-name', { number: 1 }) }) }))
    await user.click(screen.getByRole('button', { name: i18n._('markers.confirm-remove', { name: i18n._('markers.default-name', { number: 1 }) }) }))
    expect(
      screen.queryByRole('button', { name: i18n._('markers.go-to', { name: i18n._('markers.default-name', { number: 1 }) }) })
    ).not.toBeInTheDocument()
  })

  it('clears markers when a new track is loaded', async () => {
    const { user } = renderShell()
    await importTrack(user)

    await user.click(screen.getByRole('button', { name: i18n._('markers.add') }))
    expect(
      screen.getByRole('button', { name: i18n._('markers.go-to', { name: i18n._('markers.default-name', { number: 1 }) }) })
    ).toBeInTheDocument()

    await importTrack(user)
    expect(
      screen.queryByRole('button', { name: i18n._('markers.go-to', { name: i18n._('markers.default-name', { number: 1 }) }) })
    ).not.toBeInTheDocument()
  })

  it('offers no marker controls until a track is loaded, then enables them', async () => {
    const { user } = renderShell()
    // Before import the workstation (and its marker controls) is not shown —
    // the empty-state hero stands in its place.
    expect(
      screen.queryByRole('button', { name: i18n._('markers.add') })
    ).not.toBeInTheDocument()
    await importTrack(user)
    expect(
      screen.getByRole('button', { name: i18n._('markers.add') })
    ).toBeEnabled()
  })

  it('seeks the engine when the waveform is clicked', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    // A press-release at the same x is a click → seek to 50% of a 10 s timeline.
    pointerGesture(50, 50)
    expect(engine.seekTo).toHaveBeenCalledWith(5)
  })
})
