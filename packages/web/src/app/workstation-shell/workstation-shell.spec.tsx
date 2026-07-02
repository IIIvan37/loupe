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
  TrackMetadataReader
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
  return screen.getByRole('button', { name: /Forme d'onde :/ })
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
      {...overrides}
    />
  )
  return { engine, user, ...utils }
}

async function importTrack(user: UserEvent, fileName?: string): Promise<void> {
  await user.upload(
    screen.getByLabelText('Importer un fichier audio'),
    audioFile(fileName)
  )
  await waitFor(() => {
    expect(
      screen.getByRole('img', { name: "Forme d'onde de la piste" })
    ).toBeInTheDocument()
  })
}

/** Drag 20%→60% of the 10 s timeline and save the region as a named loop. */
async function saveNamedLoop(user: UserEvent, name: string): Promise<void> {
  pointerGesture(20, 60)
  await user.click(screen.getByRole('button', { name: 'Enregistrer la boucle' }))
  await user.type(screen.getByLabelText('Nom'), name)
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
}

describe('WorkstationShell', () => {
  it('renders the core workstation landmarks', () => {
    renderShell()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('exposes the analysis tabs', () => {
    renderShell()
    expect(screen.getByRole('tab', { name: 'Spectre' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Repères' })).toBeInTheDocument()
  })

  it('shows no detected key/tempo chips (no real detection yet)', () => {
    renderShell()
    expect(screen.queryByText('Tonalité')).not.toBeInTheDocument()
    expect(screen.queryByText('96 BPM')).not.toBeInTheDocument()
  })

  it('disables play until a track is loaded, then enables it with the duration', async () => {
    const { container, user } = renderShell()

    expect(screen.getByRole('button', { name: 'Lecture' })).toBeDisabled()

    await importTrack(user)

    expect(screen.getByRole('button', { name: 'Lecture' })).toBeEnabled()
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
    const input = screen.getByLabelText('Importer un fichier audio')
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
      screen.getByLabelText('Importer un fichier audio'),
      audioFile()
    )
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('unsupported format')
    })
  })

  it('plays and pauses via the transport button, driving the engine', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    await user.click(screen.getByRole('button', { name: 'Lecture' }))
    expect(engine.play).toHaveBeenCalledOnce()

    const pauseButton = screen.getByRole('button', { name: 'Pause' })
    await user.click(pauseButton)
    expect(engine.pause).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Lecture' })).toBeInTheDocument()
  })

  it('jumps to the start and end of the timeline via the transport buttons', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)
    act(() => engine.emit(5))

    await user.click(screen.getByRole('button', { name: 'Fin' }))
    expect(engine.seekTo).toHaveBeenLastCalledWith(10)

    await user.click(screen.getByRole('button', { name: 'Début' }))
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
    const importButton = screen.getByRole('button', { name: 'Importer' })
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

    const goto = screen.getByRole('button', { name: 'Aller à Repère 1' })
    await user.click(goto)
    expect(engine.seekTo).toHaveBeenLastCalledWith(5)
  })

  it('renames a marker from the inspector', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    act(() => engine.emit(5))
    fireEvent.keyDown(document.body, { key: 'm', code: 'Semicolon' })

    await user.click(screen.getByRole('button', { name: 'Renommer Repère 1' }))
    await user.clear(screen.getByLabelText('Nom'))
    await user.type(screen.getByLabelText('Nom'), 'Pont')
    await user.click(screen.getByRole('button', { name: 'Renommer' }))

    // The rail tag follows the new label; the old one is gone.
    expect(
      screen.getByRole('button', { name: 'Aller à Pont' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Aller à Repère 1' })
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
    fireEvent.change(screen.getByLabelText('Tempo en pourcentage'), {
      target: { value: '75' }
    })
    // 75 % → ratio 0.75.
    expect(engine.setTimeRatio).toHaveBeenCalledWith(0.75)
  })

  it('drives the engine pitch from the pitch slider', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    // Range slider: user-event cannot drive <input type="range">.
    fireEvent.change(screen.getByLabelText('Hauteur en demi-tons'), {
      target: { value: '5' }
    })
    expect(engine.setPitchSemitones).toHaveBeenCalledWith(5)
  })

  it('disables the tempo and pitch sliders until a track is loaded', () => {
    renderShell()
    expect(screen.getByLabelText('Tempo en pourcentage')).toBeDisabled()
    expect(screen.getByLabelText('Hauteur en demi-tons')).toBeDisabled()
  })

  it('adds a marker at the playhead and seeks back to it', async () => {
    const { engine, user } = renderShell()
    await importTrack(user)

    act(() => engine.emit(5))
    await user.click(screen.getByRole('button', { name: '+ Repère' }))

    const goto = screen.getByRole('button', { name: 'Aller à Repère 1' })
    await user.click(goto)
    expect(engine.seekTo).toHaveBeenCalledWith(5)

    await user.click(screen.getByRole('button', { name: 'Supprimer Repère 1' }))
    expect(
      screen.queryByRole('button', { name: 'Aller à Repère 1' })
    ).not.toBeInTheDocument()
  })

  it('clears markers when a new track is loaded', async () => {
    const { user } = renderShell()
    await importTrack(user)

    await user.click(screen.getByRole('button', { name: '+ Repère' }))
    expect(
      screen.getByRole('button', { name: 'Aller à Repère 1' })
    ).toBeInTheDocument()

    await importTrack(user)
    expect(
      screen.queryByRole('button', { name: 'Aller à Repère 1' })
    ).not.toBeInTheDocument()
  })

  it('disables marker controls until a track is loaded', () => {
    renderShell()
    expect(screen.getByRole('button', { name: '+ Repère' })).toBeDisabled()
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

    const recall = await screen.findByRole('button', { name: 'Mon passage' })
    await user.click(recall)
    expect(engine.seekTo).toHaveBeenCalledWith(2)
  })

  it('edits a saved loop in place when its handle moves (no re-save prompt)', async () => {
    const { user } = renderShell()
    await importTrack(user)

    await saveNamedLoop(user, 'Pont')
    expect(
      screen.queryByRole('button', { name: 'Enregistrer la boucle' })
    ).not.toBeInTheDocument()

    // Drag the end handle inward: the saved loop updates rather than spawning a
    // duplicate, so no « Enregistrer » reappears and there is still one chip.
    // Kept on fireEvent: coordinate-based drag needs explicit clientX values.
    const container = waveformSurface().parentElement as HTMLElement
    container.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect
    const endHandle = screen.getByRole('button', {
      name: 'Déplacer la fin de la boucle'
    })
    fireEvent.pointerDown(endHandle, { button: 0, clientX: 60 })
    fireEvent.pointerMove(endHandle, { clientX: 40 })
    fireEvent.pointerUp(container, { button: 0, clientX: 40 })

    expect(
      screen.queryByRole('button', { name: 'Enregistrer la boucle' })
    ).not.toBeInTheDocument()
    expect(await screen.findAllByRole('button', { name: 'Pont' })).toHaveLength(1)
  })

  it('lets the region be saved again after its saved loop is removed', async () => {
    const { user } = renderShell()
    await importTrack(user)

    await saveNamedLoop(user, 'Refrain')
    // The region belongs to a saved loop now, so the save action is gone.
    expect(
      screen.queryByRole('button', { name: 'Enregistrer la boucle' })
    ).not.toBeInTheDocument()

    // Removing that loop orphans the region — it must read as unsaved again.
    await user.click(screen.getByRole('button', { name: 'Supprimer Refrain' }))

    expect(
      await screen.findByRole('button', { name: 'Enregistrer la boucle' })
    ).toBeInTheDocument()
  })

  it('clears the saved loops when a new file is imported', async () => {
    const { user } = renderShell()
    await importTrack(user)

    await saveNamedLoop(user, 'Refrain')
    await screen.findByRole('button', { name: 'Refrain' })

    // A new track gets a fresh timeline — the old loops don't belong to it.
    await importTrack(user, 'autre.wav')

    expect(
      screen.queryByRole('button', { name: 'Refrain' })
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
    await user.click(screen.getByRole('button', { name: /Boucle active/ }))
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

    // The action is disabled until a track is loaded.
    expect(
      screen.getByRole('button', { name: 'Séparer les pistes' })
    ).toBeDisabled()

    await importTrack(user)
    await user.click(screen.getByRole('button', { name: 'Séparer les pistes' }))

    // The stems land in the mixer: one fader (and lane) per separated stem.
    expect(
      await screen.findByRole('slider', { name: 'Volume Voix' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('slider', { name: 'Volume Basse' })
    ).toBeInTheDocument()
    // The action is gone once the stems are ready.
    expect(
      screen.queryByRole('button', { name: 'Séparer les pistes' })
    ).not.toBeInTheDocument()
  })

  it('surfaces a separation failure and offers a retry', async () => {
    const { user } = renderShell({ separator: failingSeparator })
    await importTrack(user)

    await user.click(screen.getByRole('button', { name: 'Séparer les pistes' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('moteur indisponible')
    expect(
      screen.getByRole('button', { name: 'Réessayer' })
    ).toBeInTheDocument()
  })

  it('reports the server health in the header once probed', async () => {
    renderShell({ healthFetch: healthFetch('cuda') })
    expect(await screen.findByText('Serveur prêt')).toBeInTheDocument()
  })

  it('tells apart an unreachable server from one without separation', async () => {
    renderShell({ healthFetch: healthFetch('unreachable') })
    expect(await screen.findByText('Serveur hors ligne')).toBeInTheDocument()

    renderShell({ healthFetch: healthFetch(null) })
    expect(
      await screen.findByText('Séparation indisponible')
    ).toBeInTheDocument()
  })

  /** First save through the header popover, under the given name. */
  async function saveProjectAs(user: UserEvent, name: string): Promise<void> {
    await user.click(
      screen.getByRole('button', { name: 'Enregistrer le projet' })
    )
    await user.clear(screen.getByLabelText('Nom'))
    await user.type(screen.getByLabelText('Nom'), name)
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    // The one-click re-save appears once the project exists.
    await screen.findByRole('button', { name: 'Renommer le projet' })
  }

  it('surfaces a failed save as a dismissible alert banner', async () => {
    const { user } = renderShell({ projectStores: brokenProjectStores() })
    await importTrack(user)

    await user.click(
      screen.getByRole('button', { name: 'Enregistrer le projet' })
    )
    await user.clear(screen.getByLabelText('Nom'))
    await user.type(screen.getByLabelText('Nom'), 'Mon projet')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      "Impossible d'enregistrer le projet : server down"
    )

    await user.click(screen.getByRole('button', { name: "Fermer l'alerte" }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('re-saves an existing project in one click, keeping a rename popover', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Mon projet')

    // One direct click — no popover asks for the name again.
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(screen.queryByLabelText('Nom')).not.toBeInTheDocument()

    // Still a single project, under the same name.
    await user.click(screen.getByRole('button', { name: 'Projets' }))
    expect(await screen.findByText('Mon projet')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Ouvrir' })).toHaveLength(1)
  })

  it('detaches the session from the saved project when a new file is imported', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Premier morceau')

    // A new import starts a fresh session — the header must offer a first
    // save (name popover), not a one-click re-save onto the old project.
    await importTrack(user)

    expect(
      screen.getByRole('button', { name: 'Enregistrer le projet' })
    ).toBeInTheDocument()
  })

  it('saves the re-imported session as a second project, not over the first', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Premier morceau')

    await importTrack(user)
    await saveProjectAs(user, 'Deuxième morceau')

    await user.click(screen.getByRole('button', { name: 'Projets' }))
    expect(
      await screen.findAllByRole('button', { name: 'Ouvrir' })
    ).toHaveLength(2)
  })

  it('asks before opening a project over the loaded session', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveProjectAs(user, 'Mon projet')

    await user.click(screen.getByRole('button', { name: 'Projets' }))
    await user.click(await screen.findByRole('button', { name: 'Ouvrir' }))

    // The session would be replaced — the row asks for a confirmation first.
    expect(
      screen.getByText('La session actuelle sera remplacée')
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', {
        name: "Confirmer l'ouverture de Mon projet"
      })
    )
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Ouvrir' })
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

    await user.click(screen.getByRole('button', { name: 'Projets' }))
    await user.click(await screen.findByRole('button', { name: 'Ouvrir' }))
    await user.click(
      screen.getByRole('button', { name: "Confirmer l'ouverture de Mon projet" })
    )

    // The region must come back armed, exactly as the user left it.
    expect(
      await screen.findByRole('button', { name: '⟳ Boucle active' })
    ).toBeInTheDocument()
  })

  it('restores the loupe with looping still disabled when it was off at save', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    pointerGesture(20, 60)
    // Turn the wrap-around off before saving: play-through mode.
    await user.click(screen.getByRole('button', { name: '⟳ Boucle active' }))
    await saveProjectAs(user, 'Mon projet')

    await importTrack(user, 'autre.wav')
    await user.click(screen.getByRole('button', { name: 'Projets' }))
    await user.click(await screen.findByRole('button', { name: 'Ouvrir' }))
    await user.click(
      screen.getByRole('button', { name: "Confirmer l'ouverture de Mon projet" })
    )

    // The region is back but still in play-through mode, as it was saved.
    expect(
      await screen.findByRole('button', { name: '⟳ Boucle inactive' })
    ).toBeInTheDocument()
  })

  it('relinks the restored region to its saved loop (no duplicate save offered)', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveNamedLoop(user, 'Refrain')
    await saveProjectAs(user, 'Mon projet')

    await importTrack(user, 'autre.wav')
    await user.click(screen.getByRole('button', { name: 'Projets' }))
    await user.click(await screen.findByRole('button', { name: 'Ouvrir' }))
    await user.click(
      screen.getByRole('button', { name: "Confirmer l'ouverture de Mon projet" })
    )

    // The region is armed AND recognised as the saved « Refrain »: offering
    // « Enregistrer la boucle » again would invite a duplicate.
    await screen.findByRole('button', { name: '⟳ Boucle active' })
    expect(
      screen.queryByRole('button', { name: 'Enregistrer la boucle' })
    ).not.toBeInTheDocument()
  })

  it('restores the saved loops when a project is reopened', async () => {
    const { user } = renderShell({ projectStores: fakeProjectStores() })
    await importTrack(user)
    await saveNamedLoop(user, 'Refrain')
    await saveProjectAs(user, 'Mon projet')

    // Move on to a fresh track — its session starts without the loop.
    await importTrack(user, 'autre.wav')
    expect(
      screen.queryByRole('button', { name: 'Refrain' })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Projets' }))
    await user.click(await screen.findByRole('button', { name: 'Ouvrir' }))
    await user.click(
      screen.getByRole('button', { name: "Confirmer l'ouverture de Mon projet" })
    )

    // The reopened project must bring its saved loop back.
    expect(
      await screen.findByRole('button', { name: 'Refrain' })
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
    await user.click(screen.getByRole('button', { name: 'Projets' }))
    await user.click(await screen.findByRole('button', { name: 'Ouvrir' }))
    await user.click(
      screen.getByRole('button', { name: "Confirmer l'ouverture de Projet A" })
    )
    // The open hangs on the gated store; leave the dialog, import a new file.
    await user.click(screen.getByRole('button', { name: 'Fermer' }))
    await importTrack(user, 'nouveau.wav')

    await act(async () => {
      release?.()
    })

    // The stale open must not clobber the freshly imported session.
    expect(screen.getByText('nouveau')).toBeInTheDocument()
  })

  it('says the server is unreachable when the projects listing fails', async () => {
    const { user } = renderShell({ projectStores: brokenProjectStores() })

    await user.click(screen.getByRole('button', { name: 'Projets' }))

    expect(
      await screen.findByText(
        'Serveur injoignable — vérifie que le serveur local est lancé'
      )
    ).toBeInTheDocument()
  })
})
