// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { i18n } from '../../i18n/i18n.ts'
import {
  beatsAt,
  chartEditor,
  expectBpmReadout,
  fakeProjectStores,
  fakeStemEngine,
  importTrack,
  installShellHooks,
  openProjectsDialog,
  renderShell,
  saveProjectAs
} from './shell-test-kit.tsx'

installShellHooks()

describe('WorkstationShell chord chart', () => {
  it('restores the chord chart on reopen', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await user.type(
      await chartEditor(user),
      '[[Couplet]{enter}| Am | F |'
    )
    await saveProjectAs(user, 'Avec grille')
    // Move on to another track first — the chart the reopen brings back can
    // then only come from the manifest, never from leftover component state.
    await importTrack(user, 'autre.wav')

    await openProjectsDialog(user)
    await user.click(
      await screen.findByRole('button', { name: i18n._('projects.open') })
    )
    // The unsaved new track arms the two-step confirm — go through it.
    await user.click(
      screen.getByRole('button', {
        name: i18n._('projects.confirm-open', { name: 'Avec grille' })
      })
    )

    // The restored chart renders first (the read view is the default)…
    await waitFor(() => {
      expect(screen.getByText('Am')).toBeInTheDocument()
    })
    // …and the source text comes back verbatim behind « Modifier ».
    expect(await chartEditor(user)).toHaveValue('[Couplet]\n| Am | F |')
  })

  it('restores the followed key offset on reopen — the indicator stays off', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await user.type(
      await chartEditor(user),
      '| C | Am |'
    )
    // Shift the audio up two semitones: the grid now shows the wrong key and
    // the divergence flag offers to transpose it along.
    fireEvent.change(screen.getByLabelText(i18n._('transport.pitch-slider')), {
      target: { value: '2' }
    })
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.follow-pitch') })
    )
    // Rewriting the whole grid is two-step, like the detected draft.
    await user.click(
      screen.getByRole('button', {
        name: i18n._('chords.follow-pitch-confirm')
      })
    )
    expect(await chartEditor(user)).toHaveValue(
      '| D | Bm |'
    )
    expect(
      screen.queryByRole('button', { name: i18n._('chords.follow-pitch') })
    ).not.toBeInTheDocument()
    await saveProjectAs(user, 'Suivi +2')
    // Move on to another track first — the offset the reopen brings back can
    // then only come from the manifest, never from leftover component state.
    await importTrack(user, 'autre.wav')

    await openProjectsDialog(user)
    await user.click(
      await screen.findByRole('button', { name: i18n._('projects.open') })
    )
    await user.click(
      screen.getByRole('button', {
        name: i18n._('projects.confirm-open', { name: 'Suivi +2' })
      })
    )

    // The restored chart renders first, then the source reads back verbatim.
    await waitFor(() => {
      expect(screen.getByText('Bm')).toBeInTheDocument()
    })
    expect(await chartEditor(user)).toHaveValue('| D | Bm |')
    // The restored pitch (+2) and the persisted offset agree — no flag, and
    // the untouched reopened project reads « Enregistré ».
    expect(
      screen.queryByRole('button', { name: i18n._('chords.follow-pitch') })
    ).not.toBeInTheDocument()
    expect(await screen.findByText(i18n._('header.saved'))).toBeInTheDocument()
  })

  it('reopening a chart-less project signs « Enregistré » with an empty chart', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Sans grille')

    await openProjectsDialog(user)
    await user.click(
      await screen.findByRole('button', { name: i18n._('projects.open') })
    )

    expect(await screen.findByText(i18n._('header.saved'))).toBeInTheDocument()
    expect(await chartEditor(user)).toHaveValue('')
  })

  it('highlights the chart measure under the playhead', async () => {
    // Beats every second, four to the bar → downbeats at 0 s, 4 s, 8 s.
    const detector = {
      detect: async () => ({
        bpm: 60,
        beats: beatsAt([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
      })
    }
    const { engine, user } = renderShell({ tempoDetector: detector })
    await importTrack(user)
    await expectBpmReadout(60)
    await user.type(
      await chartEditor(user),
      '| C | Am | F |'
    )
    // 5 s sits in the second bar (4 s → 8 s) → the second measure, Am.
    act(() => engine.emit(5))
    expect(screen.getByText('Am').closest('[aria-current]')).not.toBeNull()
  })

  it('seeks to a measure when its chart cell is clicked', async () => {
    // Beats every second, four to the bar → downbeats at 0 s, 4 s, 8 s.
    const detector = {
      detect: async () => ({
        bpm: 60,
        beats: beatsAt([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
      })
    }
    // The resolved detection loads the metronome, so playback (and the seek)
    // rides the stem engine — assert on it, not the single-track engine.
    const stemEngine = fakeStemEngine()
    const { user } = renderShell({ tempoDetector: detector, stemEngine })
    await importTrack(user)
    await expectBpmReadout(60)
    await user.type(await chartEditor(user), '| C | Am | F |')
    // Fold the editor away first — while it is open a measure tap locates
    // the bar's source text (AN.1), it only seeks from the reading view.
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.edit') })
    )

    // The third written measure first plays on the third downbeat (8 s).
    await user.click(
      screen.getByRole('button', {
        name: i18n._('chart.measure-seek', { number: 3 })
      })
    )
    expect(stemEngine.seekTo).toHaveBeenCalledWith(8)
  })

  it('keeps the chart cells inert without a beat grid', async () => {
    const { user } = renderShell()
    await importTrack(user)
    await user.type(await chartEditor(user), '| C | Am |')
    // While the editor is open the cells locate (AN.1) — the READING view is
    // the one with no affordance to give: fold first, then assert inert.
    await user.click(
      screen.getByRole('button', { name: i18n._('chords.edit') })
    )
    expect(
      screen.queryByRole('button', {
        name: i18n._('chart.measure-seek', { number: 1 })
      })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: i18n._('chart.measure-locate', { number: 1 })
      })
    ).not.toBeInTheDocument()
  })

  it('highlights no measure without a beat grid', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)
    await user.type(
      await chartEditor(user),
      '| C | Am |'
    )
    act(() => engine.emit(5))
    expect(screen.getByText('Am').closest('[aria-current]')).toBeNull()
  })

  it('editing the chord chart drifts the session from its saved project', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Grille sale')
    expect(await screen.findByText(i18n._('header.saved'))).toBeInTheDocument()

    await user.type(await chartEditor(user), '| C |')

    expect(await screen.findByText(i18n._('header.unsaved'))).toBeInTheDocument()
  })

  it('a fresh import starts with a clean chord chart', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await user.type(await chartEditor(user), '| C |')

    await importTrack(user, 'autre.wav')

    expect(await chartEditor(user)).toHaveValue('')
  })
})
