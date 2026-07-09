// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type {
  AudioFileDecoder,
  DecodedAudio,
  PlaybackEngine,
  Project,
  ProjectDeps,
  StemPlaybackEngine,
  StemSeparator,
  TrackMetadataReader,
  TrackSource,
  TrackSourceMetadata
} from '@app/core'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { beforeAll, vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { WorkstationShell } from './workstation-shell.tsx'

beforeAll(() => {
  // jsdom implements neither pointer-capture method; the waveform calls both.
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})

/** 10 samples at 1 Hz → a 10-second timeline, easy to read as 0:10. */
const decoded: DecodedAudio = {
  sampleRate: 1,
  channels: [[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]]
}

const okDecoder: AudioFileDecoder = { decode: async () => decoded }

/** Positioned beats (four to the bar) at the given instants — a fake detector's. */
function beatsAt(times: readonly number[]) {
  return times.map((timeSeconds, index) => ({
    timeSeconds,
    barPosition: (index % 4) + 1
  }))
}

/** Controllable fake of the playback engine port. */
function fakeEngine() {
  const listeners = new Set<(seconds: number) => void>()
  return {
    play: vi.fn(),
    pause: vi.fn(),
    seekTo: vi.fn(),
    setTimeRatio: vi.fn(),
    setPitchSemitones: vi.fn(),
    load: vi.fn(async () => {}),
    onPositionChange(listener: (seconds: number) => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    emit(seconds: number) {
      for (const listener of listeners) {
        listener(seconds)
      }
    }
  } satisfies PlaybackEngine & { emit: (s: number) => void }
}

/** A no-op stem engine so the mixer never touches real Web Audio in jsdom. */
function fakeStemEngine(): StemPlaybackEngine {
  return {
    load: vi.fn(async () => {}),
    addStem: vi.fn(async () => {}),
    removeStem: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    seekTo: vi.fn(),
    setTimeRatio: vi.fn(),
    setPitchSemitones: vi.fn(),
    setGain: vi.fn(),
    onPositionChange: () => () => {}
  }
}

function audioFile(name = 'take.wav'): File {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type: 'audio/wav' })
}

/** A tagless reader — keeps tests off the real music-metadata parser. */
const silentReader: TrackMetadataReader = {
  read: async () => ({ title: undefined, artist: undefined })
}

/** Immediate fake separator: emits one progress event, returns two stems. */
function fakeSeparator(): StemSeparator {
  return {
    async separate(audio, onProgress) {
      onProgress({ phase: 'separating', fraction: 1 })
      return [
        { id: 'voix', label: 'Voix', audio },
        { id: 'basse', label: 'Basse', audio }
      ]
    }
  }
}

/** Immediate fake track source: emits one progress event, returns bytes + metadata. */
function fakeTrackSource(
  metadata: Partial<TrackSourceMetadata> = {}
): TrackSource {
  return {
    fetch: async (_url, onProgress) => {
      onProgress({ phase: 'downloading', fraction: 1 })
      return {
        bytes: new Uint8Array([1, 2, 3, 4]).buffer,
        metadata: { title: 'Ma vidéo', ...metadata }
      }
    }
  }
}

/** A separator that always fails, to exercise the error path. */
const failingSeparator: StemSeparator = {
  separate: async () => {
    throw new Error('moteur indisponible')
  }
}

/** In-memory project stores so tests never reach the local server. */
function fakeProjectStores(): ProjectDeps {
  const manifests = new Map<string, Project>()
  const blobs = new Map<string, ArrayBuffer>()
  let nextRef = 0
  return {
    store: {
      list: async () => [...manifests.values()],
      load: async (id) => manifests.get(id),
      save: async (project) => {
        manifests.set(project.id, project)
      },
      delete: async (id) => {
        manifests.delete(id)
      }
    },
    audio: {
      put: async (bytes) => {
        const ref = `ref-${nextRef++}`
        blobs.set(ref, bytes)
        return ref
      },
      get: async (ref) => blobs.get(ref)
    }
  }
}

/** Project stores whose every operation fails, to surface the error path. */
function brokenProjectStores(): ProjectDeps {
  const fail = async () => {
    throw new Error('server down')
  }
  return {
    store: { list: fail, load: fail, save: fail, delete: fail },
    audio: { put: fail, get: fail }
  }
}

/** A health probe stub answering with the given device (or unreachable). */
function healthFetch(device: string | null | 'unreachable'): typeof fetch {
  return (async () => {
    if (device === 'unreachable') {
      throw new TypeError('fetch failed')
    }
    return { ok: true, json: async () => ({ device }) } as Response
  }) as typeof fetch
}

/** The waveform stage button (click to seek, drag to loop). */
function waveformSurface(): HTMLElement {
  return screen.getByRole('button', { name: i18n._('waveform.surface') })
}

/**
 * Drive a pointer gesture on the waveform. Ratios are measured against the
 * positioning container (the surface's parent), which we size to 100px.
 * Kept on fireEvent: coordinate-based gestures need explicit clientX values.
 */
function pointerGesture(fromX: number, toX: number): void {
  const surface = waveformSurface()
  const container = surface.parentElement as HTMLElement
  container.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect
  fireEvent.pointerDown(surface, { button: 0, clientX: fromX })
  fireEvent.pointerUp(container, { button: 0, clientX: toX })
}

/** Render the shell with the default fakes; override any port per test. */
function renderShell(
  overrides: Partial<Parameters<typeof WorkstationShell>[0]> = {}
) {
  const user = userEvent.setup()
  const engine = fakeEngine()
  const utils = render(
    <WorkstationShell
      decoder={okDecoder}
      engine={engine}
      stemEngine={fakeStemEngine()}
      metadataReader={silentReader}
      // A probe that never answers keeps the header status silent by default.
      healthFetch={(() => new Promise(() => {})) as typeof fetch}
      // A detector that never resolves keeps the auto-detect-on-import inert
      // by default; tempo tests inject one that answers.
      tempoDetector={{ detect: () => new Promise(() => {}) }}
      {...overrides}
    />,
    { wrapper: I18nTestingProvider }
  )
  return { engine, user, ...utils }
}

async function importTrack(user: UserEvent, fileName?: string): Promise<void> {
  await user.upload(
    screen.getByLabelText(i18n._('header.import-file')),
    audioFile(fileName)
  )
  // Wait on the waveform surface (present in the loaded state for both the track
  // and the summed-mix image) — the track image is transient once a resolving
  // tempo detector loads the metronome and the view switches to the mix.
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: i18n._('waveform.surface') })
    ).toBeInTheDocument()
  })
}

/** Drag 20%→60% of the 10 s timeline and save the region as a named loop. */
async function saveNamedLoop(user: UserEvent, name: string): Promise<void> {
  pointerGesture(20, 60)
  await user.click(screen.getByRole('button', { name: i18n._('loops.save-region') }))
  await user.type(screen.getByLabelText(i18n._('common.name')), name)
  await user.click(screen.getByRole('button', { name: i18n._('common.save') }))
}

/** Open the sidebar « Boucles » tab where the saved-loop library lives. */
async function openLoops(user: UserEvent): Promise<void> {
  await user.click(
    screen.getByRole('tab', { name: i18n._('analysis.tab-loops') })
  )
}

/**
 * Open the « Projets » dialog and let Base UI's deferred initial focus land
 * INSIDE it before interacting — the same settling as the projects-dialog
 * spec. That focus lands on an animation frame; in jsdom the frame can fire
 * MID-TEST, stealing focus from an armed « Confirmer ? » row and disarming it
 * under the second click (a real browser settles within one frame of opening,
 * long before a human can click).
 */
async function openProjectsDialog(user: UserEvent): Promise<void> {
  await user.click(
    screen.getByRole('button', { name: i18n._('header.projects') })
  )
  await waitFor(() => {
    // By name: a Base UI success toast also carries role="dialog".
    expect(
      screen.getByRole('dialog', { name: i18n._('projects.title') })
    ).toContainElement(document.activeElement as HTMLElement | null)
  })
}

/**
 * A saved loop's recall button: its name is « time-range + name », so exclude
 * the sibling rename/remove buttons that only carry the name after a verb.
 */
function savedLoop(name: string): RegExp {
  return new RegExp(`^(?!Renommer|Supprimer).*${name}$`)
}

/* The tempo read-out is mirrored into a visually-hidden live region for screen
 * readers; these queries assert the VISIBLE read-out, so skip that channel. */
const visibleOnly = { ignore: 'script, style, [role="status"]' }

describe('WorkstationShell', () => {
  // Picker tests spy on HTMLInputElement.prototype.click — restore even when
  // an assertion failed mid-test, so no spy (or its counts) leaks onward.
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the core workstation landmarks', () => {
    renderShell()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('exposes the analysis tabs once a track is loaded', async () => {
    const { user } = renderShell()
    await importTrack(user)
    expect(screen.getByRole('tab', { name: i18n._('analysis.tab-spectrum') })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: i18n._('analysis.tab-markers') })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: i18n._('analysis.tab-loops') })).toBeInTheDocument()
  })

  it('shows the empty-state drop hero before any track is loaded', () => {
    renderShell()
    // The workstation is replaced by a first-run hero prompting a drop/import,
    // not a greyed-out shell — the analysis workspace only appears once loaded.
    expect(screen.getByText(i18n._('empty.headline'))).toBeInTheDocument()
    expect(
      screen.queryByRole('tab', { name: i18n._('analysis.tab-markers') })
    ).not.toBeInTheDocument()
  })

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
    expect(await screen.findByText(i18n._('tempo.bpm', { 0: 128 }), visibleOnly)).toBeInTheDocument()
    expect(document.querySelectorAll('[data-beat]')).toHaveLength(3)
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
    expect(await screen.findByText(i18n._('tempo.bpm', { 0: 128 }), visibleOnly)).toBeInTheDocument()
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
    await screen.findByText(i18n._('tempo.bpm', { 0: 120 }), visibleOnly)

    expect(
      screen.getByRole('button', {
        name: i18n._('mixer.download-wav', { name: 'Voix' })
      })
    ).toBeInTheDocument()
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

  it('restores the tempo and metronome on reopen without re-detecting', async () => {
    const detect = vi.fn(async () => ({ bpm: 120, beats: beatsAt([0, 0.5, 1]) }))
    const { user } = renderShell({
      projectStores: fakeProjectStores(),
      tempoDetector: { detect }
    })
    await importTrack(user)
    await screen.findByText(i18n._('tempo.bpm', { 0: 120 }), visibleOnly)
    await saveProjectAs(user, 'Avec métronome')

    await openProjectsDialog(user)
    await user.click(
      await screen.findByRole('button', { name: i18n._('projects.open') })
    )

    // The BPM and the click stem are back — seated from the manifest, so the
    // detector is never asked a second time (no server on reopen).
    expect(await screen.findByText(i18n._('tempo.bpm', { 0: 120 }), visibleOnly)).toBeInTheDocument()
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

  /** jsdom implements neither; downloadBlob needs both. */
  function stubDownload(): void {
    URL.createObjectURL = vi.fn(() => 'blob:test')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  }

  it('confirms a synthetic-lane WAV download (Piste, Métronome) with a toast', async () => {
    stubDownload()
    const detector = {
      detect: async () => ({ bpm: 120, beats: beatsAt([0, 0.5, 1]) })
    }
    const { user } = renderShell({ tempoDetector: detector })
    await importTrack(user)

    // The un-separated track exposes its own « Piste » lane plus the click.
    await user.click(
      await screen.findByRole('button', {
        name: i18n._('mixer.download-wav', { name: 'Piste' })
      })
    )
    expect(
      await screen.findByText(i18n._('toast.file-exported'))
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: i18n._('mixer.download-wav', { name: 'Métronome' })
      })
    )
    expect(
      await screen.findAllByText(i18n._('toast.file-exported'))
    ).not.toHaveLength(0)
  })

  it('confirms a separated-stem WAV download with a toast', async () => {
    stubDownload()
    const { user } = renderShell({ separator: fakeSeparator() })
    await importTrack(user)
    await user.click(
      screen.getByRole('button', { name: i18n._('separation.separate') })
    )

    await user.click(
      await screen.findByRole('button', {
        name: i18n._('mixer.download-wav', { name: 'Voix' })
      })
    )
    expect(
      await screen.findByText(i18n._('toast.file-exported'))
    ).toBeInTheDocument()
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

  it('surfaces a tempo detection failure as an alert', async () => {
    const detector = {
      detect: async () => {
        throw new Error('serveur injoignable')
      }
    }
    const { user } = renderShell({ tempoDetector: detector })
    await importTrack(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'serveur injoignable'
    )
  })

  it('disables play until a track is loaded, then enables it with the duration', async () => {
    const { container, user } = renderShell()

    expect(screen.getByRole('button', { name: i18n._('transport.play') })).toBeDisabled()

    await importTrack(user)

    expect(screen.getByRole('button', { name: i18n._('transport.play') })).toBeEnabled()
    // Scope to the transport — the ruler also prints timecodes.
    const footer = container.querySelector('footer') as HTMLElement
    expect(within(footer).getByText('0:10')).toBeInTheDocument()
  })

  it('ignores a superseded import that resolves after the newer one', async () => {
    const pending: Array<(audio: DecodedAudio) => void> = []
    const decoder: AudioFileDecoder = {
      decode: () =>
        new Promise((resolve) => {
          pending.push(resolve)
        })
    }
    const { user, container } = renderShell({ decoder })
    const input = screen.getByLabelText(i18n._('header.import-file'))
    await user.upload(input, audioFile('lent.wav'))
    await user.upload(input, audioFile('rapide.wav'))

    // The newer import resolves first (10 s)...
    await act(async () => {
      pending[1]?.(decoded)
    })
    // ...then the stale one lands with a different, shorter timeline.
    await act(async () => {
      pending[0]?.({ sampleRate: 1, channels: [[0, 0.5, 1]] })
    })

    const footer = container.querySelector('footer') as HTMLElement
    expect(within(footer).getByText('0:10')).toBeInTheDocument()
  })

  it('surfaces a decode failure as an alert', async () => {
    const decoder: AudioFileDecoder = {
      decode: async () => {
        throw new Error('unsupported format')
      }
    }
    const { user } = renderShell({ decoder })

    await user.upload(
      screen.getByLabelText(i18n._('header.import-file')),
      audioFile()
    )
    // The alert speaks plain words; the technical detail stays visible beside it.
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        i18n._('waveform.import-error')
      )
    })
    expect(screen.getByText('unsupported format')).toBeInTheDocument()
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

    // Stopping keeps the earned tempo and brings the arm action back.
    await user.click(
      screen.getByRole('button', { name: i18n._('loops.trainer-stop') })
    )
    expect(
      screen.getByRole('button', { name: i18n._('loops.trainer-open') })
    ).toBeInTheDocument()
    expect(screen.getByText('75 %')).toBeInTheDocument()
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

  it('shows the file tags in the header once read', async () => {
    const reader: TrackMetadataReader = {
      read: async () => ({ title: 'Nocturne', artist: 'Lena Vasquez' })
    }
    const { user } = renderShell({ metadataReader: reader })
    await importTrack(user)

    expect(await screen.findByText('Nocturne')).toBeInTheDocument()
    expect(screen.getByText('Lena Vasquez')).toBeInTheDocument()
  })

  it('falls back to the file name when the file has no tags', async () => {
    const { user } = renderShell()
    await importTrack(user)

    // "take.wav" → "take" (extension stripped), no fake title applied.
    expect(screen.getByText('take')).toBeInTheDocument()
  })

  it('separates the loaded track on demand and lists the stems', async () => {
    const { user } = renderShell({ separator: fakeSeparator() })

    // The action does not exist until a track is loaded (empty-state stands in).
    expect(
      screen.queryByRole('button', { name: i18n._('separation.separate') })
    ).not.toBeInTheDocument()

    await importTrack(user)
    await user.click(screen.getByRole('button', { name: i18n._('separation.separate') }))

    // The stems land in the mixer: one fader (and lane) per separated stem.
    expect(
      await screen.findByRole('slider', { name: i18n._('mixer.volume', { name: 'Voix' }) })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('slider', { name: i18n._('mixer.volume', { name: 'Basse' }) })
    ).toBeInTheDocument()
    // The action is gone once the stems are ready.
    expect(
      screen.queryByRole('button', { name: i18n._('separation.separate') })
    ).not.toBeInTheDocument()
  })

  it('surfaces a separation failure and offers a retry', async () => {
    const { user } = renderShell({ separator: failingSeparator })
    await importTrack(user)

    await user.click(screen.getByRole('button', { name: i18n._('separation.separate') }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('moteur indisponible')
    expect(
      screen.getByRole('button', { name: i18n._('separation.retry') })
    ).toBeInTheDocument()
  })

  it('reports the server health in the header once probed', async () => {
    renderShell({ healthFetch: healthFetch('cuda') })
    expect(await screen.findByText(i18n._('header.server-ready'))).toBeInTheDocument()
  })

  it('tells apart an unreachable server from one without separation', async () => {
    renderShell({ healthFetch: healthFetch('unreachable') })
    expect(await screen.findByText(i18n._('header.server-offline'))).toBeInTheDocument()

    renderShell({ healthFetch: healthFetch(null) })
    expect(
      await screen.findByText(i18n._('header.server-no-separation'))
    ).toBeInTheDocument()
  })

  /** First save through the header popover, under the given name. */
  async function saveProjectAs(user: UserEvent, name: string): Promise<void> {
    await user.click(
      screen.getByRole('button', { name: i18n._('header.save-project') })
    )
    await user.clear(screen.getByLabelText(i18n._('common.name')))
    await user.type(screen.getByLabelText(i18n._('common.name')), name)
    await user.click(screen.getByRole('button', { name: i18n._('common.save') }))
    // The one-click re-save appears once the project exists.
    await screen.findByRole('button', { name: i18n._('header.rename-project') })
  }

  it('surfaces a failed save as a dismissible alert banner', async () => {
    const { user } = renderShell({ projectStores: brokenProjectStores() })
    await importTrack(user)

    await user.click(
      screen.getByRole('button', { name: i18n._('header.save-project') })
    )
    await user.clear(screen.getByLabelText(i18n._('common.name')))
    await user.type(screen.getByLabelText(i18n._('common.name')), 'Mon projet')
    await user.click(screen.getByRole('button', { name: i18n._('common.save') }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      "Impossible d'enregistrer le projet : server down"
    )

    await user.click(screen.getByRole('button', { name: i18n._('alerts.close') }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('re-saves an existing project in one click, keeping a rename popover', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Mon projet')

    // One direct click — no popover asks for the name again.
    await user.click(screen.getByRole('button', { name: i18n._('common.save') }))
    expect(screen.queryByLabelText('Nom')).not.toBeInTheDocument()

    // Still a single project, under the same name.
    await openProjectsDialog(user)
    expect(await screen.findByText('Mon projet')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: i18n._('projects.open') })).toHaveLength(1)
  })

  it('detaches the session from the saved project when a new file is imported', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Premier morceau')

    // A new import starts a fresh session — the header must offer a first
    // save (name popover), not a one-click re-save onto the old project.
    await importTrack(user)

    expect(
      screen.getByRole('button', { name: i18n._('header.save-project') })
    ).toBeInTheDocument()
  })

  it('saves the re-imported session as a second project, not over the first', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Premier morceau')

    await importTrack(user)
    await saveProjectAs(user, 'Deuxième morceau')

    await openProjectsDialog(user)
    expect(
      await screen.findAllByRole('button', { name: i18n._('projects.open') })
    ).toHaveLength(2)
  })

  it('asks before opening a project over unsaved session changes', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Mon projet')
    // Drift from the saved project — the session now holds unsaved work.
    await user.click(screen.getByRole('button', { name: i18n._('markers.add') }))

    await openProjectsDialog(user)
    await user.click(await screen.findByRole('button', { name: i18n._('projects.open') }))

    // The session would be replaced — the row asks for a confirmation first.
    expect(
      screen.getByText(i18n._('session.replaced'))
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', {
        name: i18n._('projects.confirm-open', { name: 'Mon projet' })
      })
    )
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: i18n._('projects.open') })
      ).not.toBeInTheDocument()
    })
  })

  it('restores the armed A/B region — the loupe — when a project is reopened', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    // An A/B drag alone (never saved as a named loop) IS the loupe being used.
    pointerGesture(20, 60)
    await saveProjectAs(user, 'Mon projet')

    await importTrack(user, 'autre.wav')

    await openProjectsDialog(user)
    await user.click(await screen.findByRole('button', { name: i18n._('projects.open') }))
    await user.click(
      screen.getByRole('button', { name: i18n._('projects.confirm-open', { name: 'Mon projet' }) })
    )

    // The region must come back armed, exactly as the user left it.
    expect(
      await screen.findByRole('button', { name: i18n._('loops.active') })
    ).toBeInTheDocument()
  })

  it('restores the loupe with looping still disabled when it was off at save', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    pointerGesture(20, 60)
    // Turn the wrap-around off before saving: play-through mode.
    await user.click(screen.getByRole('button', { name: i18n._('loops.active') }))
    await saveProjectAs(user, 'Mon projet')

    await importTrack(user, 'autre.wav')
    await openProjectsDialog(user)
    await user.click(await screen.findByRole('button', { name: i18n._('projects.open') }))
    await user.click(
      screen.getByRole('button', { name: i18n._('projects.confirm-open', { name: 'Mon projet' }) })
    )

    // The region is back but still in play-through mode, as it was saved.
    expect(
      await screen.findByRole('button', { name: i18n._('loops.inactive') })
    ).toBeInTheDocument()
  })

  it('relinks the restored region to its saved loop (no duplicate save offered)', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveNamedLoop(user, 'Refrain')
    await saveProjectAs(user, 'Mon projet')

    await importTrack(user, 'autre.wav')
    await openProjectsDialog(user)
    await user.click(await screen.findByRole('button', { name: i18n._('projects.open') }))
    await user.click(
      screen.getByRole('button', { name: i18n._('projects.confirm-open', { name: 'Mon projet' }) })
    )

    // The region is armed AND recognised as the saved « Refrain »: offering
    // « Enregistrer la boucle » again would invite a duplicate.
    await screen.findByRole('button', { name: i18n._('loops.active') })
    expect(
      screen.queryByRole('button', { name: i18n._('loops.save-region') })
    ).not.toBeInTheDocument()
  })

  it('restores the saved loops when a project is reopened', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveNamedLoop(user, 'Refrain')
    await saveProjectAs(user, 'Mon projet')

    // Move on to a fresh track — its session starts without the loop.
    await importTrack(user, 'autre.wav')
    await openLoops(user)
    expect(
      screen.queryByRole('button', { name: savedLoop('Refrain') })
    ).not.toBeInTheDocument()

    await openProjectsDialog(user)
    await user.click(await screen.findByRole('button', { name: i18n._('projects.open') }))
    await user.click(
      screen.getByRole('button', { name: i18n._('projects.confirm-open', { name: 'Mon projet' }) })
    )

    // The reopened project must bring its saved loop back.
    expect(
      await screen.findByRole('button', { name: savedLoop('Refrain') })
    ).toBeInTheDocument()
  })

  it('discards a resolving open once a new file was imported meanwhile', async () => {
    const working = fakeProjectStores()
    let gateNext = false
    let release: (() => void) | undefined
    const gated: ProjectDeps = {
      store: {
        ...working.store,
        load: (id) => {
          if (!gateNext) {
            return working.store.load(id)
          }
          return new Promise((resolve) => {
            release = () => resolve(working.store.load(id))
          })
        }
      },
      audio: working.audio
    }
    const { user } = renderShell({ projectStores: gated })
    await importTrack(user)
    await saveProjectAs(user, 'Projet A')

    gateNext = true
    await openProjectsDialog(user)
    await user.click(await screen.findByRole('button', { name: i18n._('projects.open') }))
    // The open hangs on the gated store; leave the dialog, import a new file.
    await user.click(screen.getByRole('button', { name: i18n._('common.close') }))
    await importTrack(user, 'nouveau.wav')

    await act(async () => {
      release?.()
    })

    // The stale open must not clobber the freshly imported session.
    expect(screen.getByText('nouveau')).toBeInTheDocument()
  })

  it('enables the header export only once stems are ready', async () => {
    const { user } = renderShell({ separator: fakeSeparator() })
    await importTrack(user)

    const exportButton = screen.getByRole('button', { name: i18n._('header.export') })
    expect(exportButton).toBeDisabled()

    await user.click(screen.getByRole('button', { name: i18n._('separation.separate') }))
    await waitFor(() => expect(exportButton).toBeEnabled())
  })

  it('confirms a successful stem export with a toast', async () => {
    // jsdom implements neither; downloadBlob needs both.
    URL.createObjectURL = vi.fn(() => 'blob:test')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const { user } = renderShell({ separator: fakeSeparator() })
    await importTrack(user)
    await user.click(
      screen.getByRole('button', { name: i18n._('separation.separate') })
    )
    const exportButton = screen.getByRole('button', {
      name: i18n._('header.export')
    })
    await waitFor(() => expect(exportButton).toBeEnabled())

    await user.click(exportButton)
    expect(
      await screen.findByText(i18n._('toast.stems-exported'))
    ).toBeInTheDocument()
  })

  it('shows « Enregistré », flips to « Non enregistré » on a change, back on re-save', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Mon projet')
    expect(await screen.findByText(i18n._('header.saved'))).toBeInTheDocument()

    // Any persisted-state change drifts the session from its saved project.
    await user.click(screen.getByRole('button', { name: i18n._('markers.add') }))
    expect(await screen.findByText(i18n._('header.unsaved'))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: i18n._('common.save') }))
    expect(await screen.findByText(i18n._('header.saved'))).toBeInTheDocument()
  })

  it('confirms a successful save with a toast', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Mon projet')

    expect(
      await screen.findByText(
        i18n._('toast.project-saved', { name: 'Mon projet' })
      )
    ).toBeInTheDocument()
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

  it('flips to « Non enregistré » when the tempo changes', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Mon projet')
    await screen.findByText(i18n._('header.saved'))

    // Range slider: user-event cannot drive <input type="range">.
    fireEvent.change(screen.getByLabelText(i18n._('transport.tempo-slider')), {
      target: { value: '85' }
    })

    expect(await screen.findByText(i18n._('header.unsaved'))).toBeInTheDocument()
  })

  it('restores the saved tempo and zoom when a project is reopened', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    fireEvent.change(screen.getByLabelText(i18n._('transport.tempo-slider')), {
      target: { value: '85' }
    })
    fireEvent.change(screen.getByLabelText(i18n._('waveform.zoom-slider')), {
      target: { value: '3' }
    })
    await saveProjectAs(user, 'Mon projet')

    // Move on to a fresh track and drift the tuning away from the saved one.
    await importTrack(user, 'autre.wav')
    fireEvent.change(screen.getByLabelText(i18n._('transport.tempo-slider')), {
      target: { value: '110' }
    })

    await openProjectsDialog(user)
    await user.click(await screen.findByRole('button', { name: i18n._('projects.open') }))
    await user.click(
      screen.getByRole('button', { name: i18n._('projects.confirm-open', { name: 'Mon projet' }) })
    )

    // The reopened project practises at its saved tempo and magnification.
    const tempo = screen.getByLabelText(
      i18n._('transport.tempo-slider')
    ) as HTMLInputElement
    await waitFor(() => expect(tempo.value).toBe('85'))
    expect(
      (screen.getByLabelText(i18n._('waveform.zoom-slider')) as HTMLInputElement).value
    ).toBe('3')
  })

  it('arms the import button for confirmation while the loaded track is not saved', async () => {
    const { user } = renderShell()
    await importTrack(user)

    await user.click(screen.getByRole('button', { name: i18n._('header.import') }))

    expect(
      screen.getByRole('button', {
        name: i18n._('header.import-confirm')
      })
    ).toBeInTheDocument()
  })

  it('keeps the file picker closed until the armed import is confirmed', async () => {
    const { user } = renderShell()
    await importTrack(user)
    const picker = vi.spyOn(HTMLInputElement.prototype, 'click')

    await user.click(screen.getByRole('button', { name: i18n._('header.import') }))

    expect(picker).not.toHaveBeenCalled()
  })

  it('opens the file picker once the armed import is confirmed', async () => {
    const { user } = renderShell()
    await importTrack(user)
    const picker = vi.spyOn(HTMLInputElement.prototype, 'click')

    await user.click(screen.getByRole('button', { name: i18n._('header.import') }))
    // The confirming click opens the import menu; « Fichier… » then picks.
    await user.click(
      screen.getByRole('button', {
        name: i18n._('header.import-confirm')
      })
    )
    await user.click(
      screen.getByRole('button', { name: i18n._('header.import-from-file') })
    )

    expect(picker).toHaveBeenCalledTimes(1)
  })

  it('opens the file picker from the menu when the session is saved', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Mon projet')
    await screen.findByText(i18n._('header.saved'))
    const picker = vi.spyOn(HTMLInputElement.prototype, 'click')

    // A clean session opens the menu straight away — no confirmation step.
    await user.click(screen.getByRole('button', { name: i18n._('header.import') }))
    await user.click(
      screen.getByRole('button', { name: i18n._('header.import-from-file') })
    )

    expect(picker).toHaveBeenCalledTimes(1)
  })

  it('disarms the armed import when focus leaves the button', async () => {
    const { user } = renderShell()
    await importTrack(user)
    await user.click(screen.getByRole('button', { name: i18n._('header.import') }))

    // Kept on fireEvent: only the blur itself is under test here.
    fireEvent.blur(
      screen.getByRole('button', {
        name: i18n._('header.import-confirm')
      })
    )

    expect(
      screen.getByRole('button', { name: i18n._('header.import') })
    ).toBeInTheDocument()
  })

  /** Open the import menu and its « Depuis une URL… » popover, then fill the link. */
  async function fillImportUrl(user: UserEvent, url: string): Promise<void> {
    await user.click(screen.getByRole('button', { name: i18n._('header.import') }))
    await user.click(
      screen.getByRole('button', { name: i18n._('header.import-from-url') })
    )
    // Paste (atomic) rather than type char-by-char: no intermediate host flickers
    // the unsupported warning, and no slow-typing timeout under parallel load.
    await user.click(screen.getByLabelText(i18n._('header.import-url-field')))
    await user.paste(url)
  }

  it('imports a track from a URL through the menu', async () => {
    const { user } = renderShell({
      trackSource: fakeTrackSource({ artist: 'Une chaîne' })
    })
    await fillImportUrl(user, 'https://youtu.be/abc')
    await user.click(
      screen.getByRole('button', { name: i18n._('header.import-url-submit') })
    )

    // The track loads through the same decode path; its title and artist come
    // from the source metadata (the file carries no embedded tags here).
    await waitFor(() => {
      expect(
        screen.getByRole('img', { name: i18n._('waveform.track-image') })
      ).toBeInTheDocument()
    })
    expect(screen.getByText('Ma vidéo')).toBeInTheDocument()
    expect(await screen.findByText('Une chaîne')).toBeInTheDocument()
  })

  it('surfaces a URL download failure in an alert', async () => {
    const trackSource: TrackSource = {
      fetch: async () => {
        throw new Error('vidéo introuvable')
      }
    }
    const { user } = renderShell({ trackSource })
    await fillImportUrl(user, 'https://youtu.be/abc')
    await user.click(
      screen.getByRole('button', { name: i18n._('header.import-url-submit') })
    )

    expect(await screen.findByText('vidéo introuvable')).toBeInTheDocument()
  })

  it('blocks an unsupported URL at the field, before any download', async () => {
    const fetchSpy = vi.fn()
    const { user } = renderShell({ trackSource: { fetch: fetchSpy } })
    await fillImportUrl(user, 'https://example.com/song')

    // The field validates against the same policy the use-case rejects on:
    // an inline warning, a disabled submit, and no request ever leaves.
    expect(
      screen.getByText(i18n._('header.import-url-unsupported'))
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: i18n._('header.import-url-submit') })
    ).toBeDisabled()
    await user.click(
      screen.getByRole('button', { name: i18n._('header.import-url-submit') })
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  /** Fire a cancelable beforeunload and report whether the guard blocked it. */
  function unloadPrevented(): boolean {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }

  it('blocks the page unload while the loaded track is not saved', async () => {
    const { user } = renderShell()
    await importTrack(user)

    expect(unloadPrevented()).toBe(true)
  })

  it('lets the page unload once the session is saved', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await user.click(screen.getByRole('button', { name: i18n._('markers.add') }))
    await saveProjectAs(user, 'Mon projet')
    await screen.findByText(i18n._('header.saved'))

    expect(unloadPrevented()).toBe(false)
  })

  it('opens a saved project directly when the session holds no unsaved work', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Mon projet')

    await openProjectsDialog(user)
    await user.click(await screen.findByRole('button', { name: i18n._('projects.open') }))

    // No « Confirmer ? » step: the open starts at once and closes the dialog.
    // (Scope to the projects dialog by name — a success toast is itself a
    // non-modal `role="dialog"` and would otherwise match a bare query.)
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: i18n._('projects.title') })
      ).not.toBeInTheDocument()
    })
  })

  it('announces the rebuild while a project opens', async () => {
    const working = fakeProjectStores()
    let release: (() => void) | undefined
    let gateNext = false
    const gated: ProjectDeps = {
      store: working.store,
      audio: {
        ...working.audio,
        get: (ref) => {
          if (!gateNext) {
            return working.audio.get(ref)
          }
          return new Promise((resolve) => {
            release = () => resolve(working.audio.get(ref))
          })
        }
      }
    }
    const { user } = renderShell({ projectStores: gated })
    await importTrack(user)
    await saveProjectAs(user, 'Projet lent')

    gateNext = true
    await openProjectsDialog(user)
    await user.click(await screen.findByRole('button', { name: i18n._('projects.open') }))

    expect(
      await screen.findByText(i18n._('header.opening', { name: 'Projet lent' }))
    ).toBeInTheDocument()

    await act(async () => {
      release?.()
    })
    await waitFor(() => {
      expect(
        screen.queryByText(i18n._('header.opening', { name: 'Projet lent' }))
      ).not.toBeInTheDocument()
    })
  })

  it('highlights the chip of the saved loop the region came from', async () => {
    const { user } = renderShell()
    await importTrack(user)
    await saveNamedLoop(user, 'Refrain')

    await openLoops(user)
    expect(
      await screen.findByRole('button', { name: savedLoop('Refrain') })
    ).toHaveAttribute('aria-current', 'true')
  })

  it('says the server is unreachable when the projects listing fails', async () => {
    const { user } = renderShell({ projectStores: brokenProjectStores() })

    await openProjectsDialog(user)

    expect(
      await screen.findByText(
        i18n._('projects.unreachable')
      )
    ).toBeInTheDocument()
  })

  // ── Native OS-file drop ──────────────────────────────────────────────────
  // The shell is the full-surface drop target; a dropped audio file rides the
  // exact import path the picker uses, guarded by the same unsaved-work confirm.

  /** The shell's root element — where the drop handlers live. */
  function shellRoot(): HTMLElement {
    return screen.getByRole('banner').parentElement as HTMLElement
  }

  /** A file-carrying drag/drop init, as an OS file drag produces. */
  function fileTransfer(files: File[]) {
    return { dataTransfer: { files, types: ['Files'] } }
  }

  it('shows a drop overlay while a file is dragged over the app', () => {
    renderShell()
    const root = shellRoot()
    expect(screen.queryByText(i18n._('drop.overlay'))).not.toBeInTheDocument()

    fireEvent.dragEnter(root, fileTransfer([audioFile()]))
    expect(screen.getByText(i18n._('drop.overlay'))).toBeInTheDocument()

    fireEvent.dragLeave(root, fileTransfer([audioFile()]))
    expect(screen.queryByText(i18n._('drop.overlay'))).not.toBeInTheDocument()
  })

  it('imports a dropped audio file through the picker path', async () => {
    renderShell()
    const file = audioFile('glisse.wav')

    fireEvent.dragEnter(shellRoot(), fileTransfer([file]))
    fireEvent.drop(shellRoot(), fileTransfer([file]))

    // Same decode path as the picker → the waveform surface appears.
    expect(
      await screen.findByRole('button', { name: i18n._('waveform.surface') })
    ).toBeInTheDocument()
  })

  it('ignores a dropped non-audio file — no import', () => {
    renderShell()
    const png = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })

    fireEvent.drop(shellRoot(), fileTransfer([png]))

    // The empty-state hero is untouched — nothing was imported.
    expect(screen.getByText(i18n._('empty.headline'))).toBeInTheDocument()
  })

  it('warns when a drop holds no supported audio file', () => {
    renderShell()
    const png = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })

    fireEvent.drop(shellRoot(), fileTransfer([png]))

    expect(screen.getByRole('alert')).toHaveTextContent(
      i18n._('drop.unsupported')
    )
  })

  it('clears the unsupported-drop warning when a picker import starts', async () => {
    const { user } = renderShell()
    const png = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })

    fireEvent.drop(shellRoot(), fileTransfer([png]))
    // A successful import through another path supersedes the warning.
    await importTrack(user)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('clears the unsupported-drop warning once an audio drop lands', async () => {
    renderShell()
    const png = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })

    fireEvent.drop(shellRoot(), fileTransfer([png]))
    fireEvent.drop(shellRoot(), fileTransfer([audioFile('glisse.wav')]))

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  it('confirms before a dropped file replaces unsaved work, then imports on confirm', async () => {
    const { user } = renderShell()
    await importTrack(user)

    // A loaded-but-unsaved track: the drop must ask before replacing it.
    fireEvent.drop(shellRoot(), fileTransfer([audioFile('remplace.wav')]))
    expect(
      await screen.findByText(i18n._('drop.confirm-title'))
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: i18n._('drop.confirm-import') })
    )

    // The confirmation clears and the new track loads.
    await waitFor(() => {
      expect(
        screen.queryByText(i18n._('drop.confirm-title'))
      ).not.toBeInTheDocument()
    })
    expect(
      screen.getByRole('button', { name: i18n._('waveform.surface') })
    ).toBeInTheDocument()
  })

  it('keeps the current session when a drop confirmation is cancelled', async () => {
    const { user } = renderShell()
    await importTrack(user)

    fireEvent.drop(shellRoot(), fileTransfer([audioFile('remplace.wav')]))
    await user.click(
      screen.getByRole('button', { name: i18n._('common.cancel') })
    )

    // The prompt is gone and the original track is still loaded.
    await waitFor(() => {
      expect(
        screen.queryByText(i18n._('drop.confirm-title'))
      ).not.toBeInTheDocument()
    })
    expect(
      screen.getByRole('button', { name: i18n._('waveform.surface') })
    ).toBeInTheDocument()
  })
})
