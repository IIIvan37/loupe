// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import {
  beatsAt,
  expectBpmReadout,
  fakeProjectStores,
  fakeSeparator,
  fakeStemEngine,
  importTrack,
  installShellHooks,
  openProjectsDialog,
  renderShell,
  saveProjectAs,
  tapThrice
} from './shell-test-kit.tsx'

installShellHooks()

describe('WorkstationShell tempo & metronome', () => {
  it('shows no key chip and no tempo until a track is analysed', () => {
    renderShell()
    // Key detection is not built; tempo is a user action, not shown up front.
    expect(screen.queryByText('Tonalité')).not.toBeInTheDocument()
    expect(screen.queryByText(/BPM/)).not.toBeInTheDocument()
  })

  it('auto-detects the BPM on import and draws the beat grid', async () => {
    const detector = {
      detect: async () => ({ bpm: 128, beats: beatsAt([0, 0.47, 0.94]) })
    }
    const { user } = renderShell({ tempoDetector: detector })
    await importTrack(user)

    // No click of a button — detection runs on its own once the track loads.
    await expectBpmReadout(128)
    expect(document.querySelectorAll('[data-beat]')).toHaveLength(3)
  })

  it('cancelling the auto-detection leaves a relaunch, not a dead end', async () => {
    // X.2: the first (auto) run hangs and gets cancelled — the row must keep
    // an idle « Détecter le tempo » face; clicking it re-runs the detection.
    let runs = 0
    const detector = {
      detect: () => {
        runs += 1
        return runs === 1
          ? new Promise<never>(() => {})
          : Promise.resolve({ bpm: 128, beats: beatsAt([0, 0.47, 0.94]) })
      }
    }
    const { user } = renderShell({ tempoDetector: detector })
    await importTrack(user)

    await user.click(
      await screen.findByRole('button', { name: i18n._('common.cancel') })
    )
    await user.click(
      await screen.findByRole('button', {
        name: i18n._('analyser.tempo-detect')
      })
    )
    await expectBpmReadout(128)
  })

  it('relaunches a failed tempo detection from the panel', async () => {
    // The first run fails (server unreachable), the retry succeeds.
    let runs = 0
    const detector = {
      detect: async () => {
        runs += 1
        if (runs === 1) {
          throw new Error('server unreachable')
        }
        return { bpm: 128, beats: beatsAt([0, 0.47, 0.94]) }
      }
    }
    const { user } = renderShell({ tempoDetector: detector })
    await importTrack(user)

    await user.click(
      await screen.findByRole('button', { name: i18n._('tempo.retry') })
    )
    await expectBpmReadout(128)
  })

  it('keeps the separated stems when a tempo retry succeeds after separation', async () => {
    // Detection fails on import; the user separates; only then does a retry
    // land — the late result must not re-seat the mixer over the stems.
    let runs = 0
    const detector = {
      detect: async () => {
        runs += 1
        if (runs === 1) {
          throw new Error('server unreachable')
        }
        return { bpm: 120, beats: beatsAt([0, 0.5, 1]) }
      }
    }
    const { user } = renderShell({
      separator: fakeSeparator(),
      tempoDetector: detector
    })
    await importTrack(user)
    await user.click(
      screen.getByRole('button', { name: i18n._('separation.separate') })
    )
    await screen.findByRole('button', {
      name: i18n._('mixer.download-wav', { name: 'Voix' })
    })

    await user.click(
      screen.getByRole('button', { name: i18n._('tempo.retry') })
    )
    await expectBpmReadout(120)

    expect(
      screen.getByRole('button', {
        name: i18n._('mixer.download-wav', { name: 'Voix' })
      })
    ).toBeInTheDocument()
  })

  it('sets the tempo by typing in the BPM field', async () => {
    const detector = {
      detect: async () => ({ bpm: 128, beats: beatsAt([0, 0.47, 0.94]) })
    }
    const { user } = renderShell({ tempoDetector: detector })
    await importTrack(user)
    await expectBpmReadout(128)

    const field = screen.getByRole('spinbutton', {
      name: i18n._('tempo.bpm-field')
    })
    await user.clear(field)
    await user.type(field, '96{Enter}')

    // The read-out holds the typed tempo, flagged as manual, and the beat
    // grid is rebuilt at it across the whole 10 s track (96 BPM → 0.625 s
    // interval → 17 beats).
    await expectBpmReadout(96)
    expect(screen.getByText(i18n._('tempo.manual-badge'))).toBeInTheDocument()
    expect(document.querySelectorAll('[data-beat]')).toHaveLength(17)
  })

  it('taps a tempo when the detection failed', async () => {
    const detector = {
      detect: async () => {
        throw new Error('server unreachable')
      }
    }
    const { user } = renderShell({ tempoDetector: detector })
    await importTrack(user)
    await screen.findByRole('button', { name: i18n._('tempo.retry') })

    // Three taps half a second apart — the manual fallback when no server.
    const tap = screen.getByRole('button', { name: i18n._('tempo.tap') })
    await tapThrice(() => user.click(tap))

    await expectBpmReadout(120)
    expect(screen.getByText(i18n._('tempo.manual-badge'))).toBeInTheDocument()
  })

  it('re-anchors the beat grid on the playhead from the panel', async () => {
    // Detected grid anchored at 0.25 s; the playhead sits at 0 — « Caler »
    // pulls a downbeat onto it.
    const detector = {
      detect: async () => ({ bpm: 120, beats: beatsAt([0.25, 0.75, 1.25]) })
    }
    const { user } = renderShell({ tempoDetector: detector })
    await importTrack(user)
    await expectBpmReadout(120)

    await user.click(
      screen.getByRole('button', { name: i18n._('tempo.align') })
    )

    // 120 BPM over 10 s anchored at 0: 21 beats, downbeat on the first.
    await waitFor(() =>
      expect(document.querySelectorAll('[data-beat]')).toHaveLength(21)
    )
    expect(
      document.querySelectorAll('[data-beat="downbeat"]')[0]
    ).toBeTruthy()
    expect(screen.getByText(i18n._('tempo.manual-badge'))).toBeInTheDocument()
  })

  it('saves and reopens a manual tempo without re-detecting', async () => {
    const detect = vi.fn(async () => ({
      bpm: 120,
      beats: beatsAt([0, 0.5, 1])
    }))
    const { user } = renderShell({
      projectStores: fakeProjectStores(),
      tempoDetector: { detect }
    })
    await importTrack(user)
    await expectBpmReadout(120)

    const field = screen.getByRole('spinbutton', {
      name: i18n._('tempo.bpm-field')
    })
    await user.clear(field)
    await user.type(field, '96{Enter}')
    await expectBpmReadout(96)
    await saveProjectAs(user, 'Tempo à la main')

    await openProjectsDialog(user)
    await user.click(
      await screen.findByRole('button', { name: i18n._('projects.open') })
    )

    // The typed tempo and its manual flag come back from the manifest — the
    // detector is never asked again (its result would overwrite the override).
    await expectBpmReadout(96)
    expect(screen.getByText(i18n._('tempo.manual-badge'))).toBeInTheDocument()
    expect(detect).toHaveBeenCalledTimes(1)
  })

  it('corrects a misdetected meter from the panel and keeps it on reopen', async () => {
    // A 4/4 song the detector read as 6 temps (The Logical Song case): twelve
    // beats every 0.5 s whose bar positions cycle over six.
    const detect = vi.fn(async () => ({
      bpm: 120,
      beats: Array.from({ length: 12 }, (_, index) => ({
        timeSeconds: index * 0.5,
        barPosition: (index % 6) + 1
      }))
    }))
    const { user } = renderShell({
      projectStores: fakeProjectStores(),
      tempoDetector: { detect }
    })
    await importTrack(user)
    await expectBpmReadout(120)
    expect(document.querySelectorAll('[data-beat="downbeat"]')).toHaveLength(2)

    const field = screen.getByRole('spinbutton', {
      name: i18n._('tempo.meter-field')
    })
    expect(field).toHaveValue(6)
    await user.clear(field)
    await user.type(field, '4{Enter}')

    // The downbeats re-flag every four beats (0, 4, 8); every instant stays.
    expect(document.querySelectorAll('[data-beat="downbeat"]')).toHaveLength(3)
    expect(document.querySelectorAll('[data-beat]')).toHaveLength(12)

    await saveProjectAs(user, 'Mètre corrigé')
    await openProjectsDialog(user)
    await user.click(
      await screen.findByRole('button', { name: i18n._('projects.open') })
    )

    // The corrected meter comes back from the manifest — never re-detected.
    await waitFor(() =>
      expect(
        screen.getByRole('spinbutton', { name: i18n._('tempo.meter-field') })
      ).toHaveValue(4)
    )
    expect(document.querySelectorAll('[data-beat="downbeat"]')).toHaveLength(3)
    expect(detect).toHaveBeenCalledTimes(1)
  })

  it('shows the metronome as a mixer stem automatically once detected', async () => {
    const detector = {
      detect: async () => ({ bpm: 120, beats: beatsAt([0, 0.5, 1]) })
    }
    const { user } = renderShell({ tempoDetector: detector })
    await importTrack(user)

    // It rides the mixer like any stem — its lane header (with a WAV export)
    // appears on its own, no button.
    expect(
      await screen.findByRole('button', {
        name: i18n._('mixer.download-wav', { name: 'Métronome' })
      })
    ).toBeInTheDocument()
  })

  it('seats a freshly detected metronome muted by default', async () => {
    const detector = {
      detect: async () => ({ bpm: 120, beats: beatsAt([0, 0.5, 1]) })
    }
    const { user } = renderShell({ tempoDetector: detector })
    await importTrack(user)

    // Unlike the other voices, the click starts muted — hear it by unmuting.
    const mute = await screen.findByRole('button', {
      name: i18n._('mixer.mute', { name: 'Métronome' })
    })
    expect(mute).toHaveAttribute('aria-pressed', 'true')
  })

  it('counts one bar in before starting when the click lane is audible', async () => {
    const detector = {
      detect: async () => ({ bpm: 120, beats: beatsAt([0, 0.5, 1]) })
    }
    let endCountIn: (() => void) | undefined
    const countInPlayer = {
      play: vi.fn((_countIn, onEnded: () => void) => {
        endCountIn = onEnded
        return vi.fn()
      })
    }
    const stemEngine = fakeStemEngine()
    const { user } = renderShell({
      tempoDetector: detector,
      stemEngine,
      countInPlayer
    })
    await importTrack(user)
    // Unmute the click — the count-in only fronts an audible metronome.
    await user.click(
      await screen.findByRole('button', {
        name: i18n._('mixer.mute', { name: 'Métronome' })
      })
    )

    await user.click(
      screen.getByRole('button', { name: i18n._('transport.play') })
    )

    // One bar of clicks sounds first; the transport hasn't started, but the
    // button already reads « Pause » — pressing it would abandon the count.
    expect(countInPlayer.play).toHaveBeenCalledOnce()
    expect(stemEngine.play).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: i18n._('transport.pause') })
    ).toBeInTheDocument()

    act(() => {
      endCountIn?.()
    })
    expect(stemEngine.play).toHaveBeenCalledOnce()
  })

  it('a press during the count abandons it instead of starting', async () => {
    const detector = {
      detect: async () => ({ bpm: 120, beats: beatsAt([0, 0.5, 1]) })
    }
    const cancel = vi.fn()
    const countInPlayer = { play: vi.fn(() => cancel) }
    const stemEngine = fakeStemEngine()
    const { user } = renderShell({
      tempoDetector: detector,
      stemEngine,
      countInPlayer
    })
    await importTrack(user)
    await user.click(
      await screen.findByRole('button', {
        name: i18n._('mixer.mute', { name: 'Métronome' })
      })
    )

    await user.click(
      screen.getByRole('button', { name: i18n._('transport.play') })
    )
    await user.click(
      screen.getByRole('button', { name: i18n._('transport.pause') })
    )

    expect(cancel).toHaveBeenCalledOnce()
    expect(stemEngine.play).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: i18n._('transport.play') })
    ).toBeInTheDocument()
  })

  it('starts immediately while the click lane stays muted', async () => {
    const detector = {
      detect: async () => ({ bpm: 120, beats: beatsAt([0, 0.5, 1]) })
    }
    const countInPlayer = { play: vi.fn(() => vi.fn()) }
    const stemEngine = fakeStemEngine()
    const { user } = renderShell({
      tempoDetector: detector,
      stemEngine,
      countInPlayer
    })
    await importTrack(user)
    // The metronome seats muted by default — leave it that way and play.
    await screen.findByRole('button', {
      name: i18n._('mixer.mute', { name: 'Métronome' })
    })

    await user.click(
      screen.getByRole('button', { name: i18n._('transport.play') })
    )

    expect(countInPlayer.play).not.toHaveBeenCalled()
    expect(stemEngine.play).toHaveBeenCalledOnce()
  })

  it('restores the tempo and metronome on reopen without re-detecting', async () => {
    const detect = vi.fn(async () => ({ bpm: 120, beats: beatsAt([0, 0.5, 1]) }))
    const { user } = renderShell({
      projectStores: fakeProjectStores(),
      tempoDetector: { detect }
    })
    await importTrack(user)
    await expectBpmReadout(120)
    await saveProjectAs(user, 'Avec métronome')

    await openProjectsDialog(user)
    await user.click(
      await screen.findByRole('button', { name: i18n._('projects.open') })
    )

    // The BPM and the click stem are back — seated from the manifest, so the
    // detector is never asked a second time (no server on reopen).
    await expectBpmReadout(120)
    expect(
      await screen.findByRole('button', {
        name: i18n._('mixer.download-wav', { name: 'Métronome' })
      })
    ).toBeInTheDocument()
    expect(detect).toHaveBeenCalledTimes(1)
  })

  it('restores the metronome mute state the user saved, over the default', async () => {
    const detector = {
      detect: async () => ({ bpm: 120, beats: beatsAt([0, 0.5, 1]) })
    }
    const { user } = renderShell({
      projectStores: fakeProjectStores(),
      tempoDetector: detector
    })
    await importTrack(user)
    // Unmute the click (muted by default), then save that choice.
    const mute = await screen.findByRole('button', {
      name: i18n._('mixer.mute', { name: 'Métronome' })
    })
    await user.click(mute)
    expect(mute).toHaveAttribute('aria-pressed', 'false')
    await saveProjectAs(user, 'Clic activé')

    await openProjectsDialog(user)
    await user.click(
      await screen.findByRole('button', { name: i18n._('projects.open') })
    )

    // The click comes back un-muted — the saved setting won over the default.
    const restored = await screen.findByRole('button', {
      name: i18n._('mixer.mute', { name: 'Métronome' })
    })
    expect(restored).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps the separated stems AND the metronome after separating', async () => {
    const detector = {
      detect: async () => ({ bpm: 120, beats: beatsAt([0, 0.5, 1]) })
    }
    const { user } = renderShell({
      separator: fakeSeparator(),
      tempoDetector: detector
    })
    await importTrack(user)
    // The metronome is seated on the un-separated track first.
    await screen.findByRole('button', {
      name: i18n._('mixer.download-wav', { name: 'Métronome' })
    })

    await user.click(screen.getByRole('button', { name: i18n._('separation.separate') }))

    // Separation replaces the mix — the stems must show, with the click kept.
    expect(
      await screen.findByRole('button', {
        name: i18n._('mixer.download-wav', { name: 'Voix' })
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: i18n._('mixer.download-wav', { name: 'Basse' })
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: i18n._('mixer.download-wav', { name: 'Métronome' })
      })
    ).toBeInTheDocument()
    // The « Piste » catch-all from the un-separated state is gone.
    expect(
      screen.queryByRole('button', {
        name: i18n._('mixer.download-wav', { name: 'Piste' })
      })
    ).not.toBeInTheDocument()
  })

  it('drops the metronome stem when a new file is imported', async () => {
    const detector = {
      detect: async () => ({ bpm: 120, beats: beatsAt([0, 0.5, 1]) })
    }
    const { user } = renderShell({ tempoDetector: detector })
    await importTrack(user)
    await screen.findByRole('button', {
      name: i18n._('mixer.download-wav', { name: 'Métronome' })
    })

    await importTrack(user, 'autre.wav')

    // The fresh track re-detects; its click stem replaces the old one, and there
    // is never a lingering one from the previous track.
    await screen.findByRole('button', {
      name: i18n._('mixer.download-wav', { name: 'Métronome' })
    })
    expect(
      screen.getAllByRole('button', {
        name: i18n._('mixer.download-wav', { name: 'Métronome' })
      })
    ).toHaveLength(1)
  })

  it('surfaces a tempo detection failure as translated, actionable copy', async () => {
    // The raw engine text stays in the console — the alert speaks the code.
    const detector = {
      detect: async () => {
        throw new Error('serveur injoignable')
      }
    }
    const { user } = renderShell({ tempoDetector: detector })
    await importTrack(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      i18n._('tempo.error.unknown')
    )
  })

  it('resets the tempo to 100 % when a new file is imported', async () => {
    const { user } = renderShell()
    await importTrack(user)

    // Range slider: user-event cannot drive <input type="range">.
    fireEvent.change(screen.getByLabelText(i18n._('transport.tempo-slider')), {
      target: { value: '70' }
    })

    // A fresh, unrelated track must not inherit the previous track's tempo.
    await importTrack(user, 'autre.wav')

    const tempo = screen.getByLabelText(
      i18n._('transport.tempo-slider')
    ) as HTMLInputElement
    expect(tempo.value).toBe('100')
  })
})
