// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type {
  AudioFileDecoder,
  DecodedAudio,
  LoopLibrary,
  LoopStore,
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

function audioFile(): File {
  return new File([new Uint8Array([1, 2, 3, 4])], 'take.wav', { type: 'audio/wav' })
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

/** An in-memory loop store so tests never touch real localStorage. */
function fakeLoopStore(): LoopStore {
  let saved: LoopLibrary = []
  return {
    load: async () => saved,
    save: async (library) => {
      saved = library
    }
  }
}

/** The waveform stage button (click to seek, drag to loop). */
function waveformSurface(): HTMLElement {
  return screen.getByRole('button', { name: /Forme d'onde :/ })
}

/**
 * Drive a pointer gesture on the waveform. Ratios are measured against the
 * positioning container (the surface's parent), which we size to 100px.
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
  return { engine, ...utils }
}

async function importTrack(): Promise<void> {
  fireEvent.change(screen.getByLabelText('Importer un fichier audio'), {
    target: { files: [audioFile()] }
  })
  await waitFor(() => {
    expect(
      screen.getByRole('img', { name: "Forme d'onde de la piste" })
    ).toBeInTheDocument()
  })
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
    const { container } = renderShell()

    expect(screen.getByRole('button', { name: 'Lecture' })).toBeDisabled()

    await importTrack()

    expect(screen.getByRole('button', { name: 'Lecture' })).toBeEnabled()
    // Scope to the transport — the ruler also prints timecodes.
    const footer = container.querySelector('footer') as HTMLElement
    expect(within(footer).getByText('0:10')).toBeInTheDocument()
  })

  it('surfaces a decode failure as an alert', async () => {
    const decoder: AudioFileDecoder = {
      decode: async () => {
        throw new Error('unsupported format')
      }
    }
    renderShell({ decoder })

    fireEvent.change(screen.getByLabelText('Importer un fichier audio'), {
      target: { files: [audioFile()] }
    })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('unsupported format')
    })
  })

  it('plays and pauses via the transport button, driving the engine', async () => {
    const { engine } = renderShell()
    await importTrack()

    fireEvent.click(screen.getByRole('button', { name: 'Lecture' }))
    expect(engine.play).toHaveBeenCalledOnce()

    const pauseButton = screen.getByRole('button', { name: 'Pause' })
    fireEvent.click(pauseButton)
    expect(engine.pause).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Lecture' })).toBeInTheDocument()
  })

  it('jumps to the start and end of the timeline via the transport buttons', async () => {
    const { engine } = renderShell()
    await importTrack()
    act(() => engine.emit(5))

    fireEvent.click(screen.getByRole('button', { name: 'Fin' }))
    expect(engine.seekTo).toHaveBeenLastCalledWith(10)

    fireEvent.click(screen.getByRole('button', { name: 'Début' }))
    expect(engine.seekTo).toHaveBeenLastCalledWith(0)
  })

  it('reflects the engine position as a timecode', async () => {
    const { engine, container } = renderShell()
    await importTrack()

    act(() => engine.emit(5))
    const footer = container.querySelector('footer') as HTMLElement
    expect(within(footer).getByText('0:05')).toBeInTheDocument()
  })

  it('toggles playback with the Space key', async () => {
    const { engine } = renderShell()
    await importTrack()

    fireEvent.keyDown(document.body, { code: 'Space' })
    expect(engine.play).toHaveBeenCalledOnce()
  })

  it('still fires shortcuts while a control button holds focus', async () => {
    const { engine } = renderShell()
    await importTrack()

    // Importing leaves focus on the "Importer" button; Space must still toggle
    // playback rather than being swallowed as the button's own activation.
    const importButton = screen.getByRole('button', { name: 'Importer' })
    importButton.focus()
    fireEvent.keyDown(importButton, { code: 'Space' })
    expect(engine.play).toHaveBeenCalledOnce()
  })

  it('does not fire shortcuts while typing in a text field', async () => {
    const { engine } = renderShell()
    await importTrack()

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
    const { engine } = renderShell()
    await importTrack()

    act(() => engine.emit(5))
    fireEvent.keyDown(document.body, { code: 'ArrowRight' })
    // 5 s + 5 s step → 10 s (the timeline end).
    expect(engine.seekTo).toHaveBeenLastCalledWith(10)

    act(() => engine.emit(5))
    fireEvent.keyDown(document.body, { code: 'ArrowLeft' })
    expect(engine.seekTo).toHaveBeenLastCalledWith(0)
  })

  it('adds a marker at the playhead with the M key', async () => {
    const { engine } = renderShell()
    await importTrack()

    act(() => engine.emit(5))
    // Bound by character ('m'), not physical position — works on any layout.
    fireEvent.keyDown(document.body, { key: 'm', code: 'Semicolon' })

    const goto = screen.getByRole('button', { name: 'Aller à Repère 1' })
    fireEvent.click(goto)
    expect(engine.seekTo).toHaveBeenLastCalledWith(5)
  })

  it('renames a marker from the inspector', async () => {
    const { engine } = renderShell()
    await importTrack()

    act(() => engine.emit(5))
    fireEvent.keyDown(document.body, { key: 'm', code: 'Semicolon' })

    fireEvent.click(screen.getByRole('button', { name: 'Renommer Repère 1' }))
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Pont' } })
    fireEvent.click(screen.getByRole('button', { name: 'Renommer' }))

    // The rail tag follows the new label; the old one is gone.
    expect(
      screen.getByRole('button', { name: 'Aller à Pont' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Aller à Repère 1' })
    ).not.toBeInTheDocument()
  })

  it('zooms with the + and - characters, regardless of layout', async () => {
    renderShell()
    await importTrack()

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
    const { engine } = renderShell()
    await importTrack()

    fireEvent.keyDown(document.body, { code: 'Space', metaKey: true })
    expect(engine.play).not.toHaveBeenCalled()
  })

  it('drives the engine tempo from the tempo slider', async () => {
    const { engine } = renderShell()
    await importTrack()

    fireEvent.change(screen.getByLabelText('Tempo en pourcentage'), {
      target: { value: '75' }
    })
    // 75 % → ratio 0.75.
    expect(engine.setTimeRatio).toHaveBeenCalledWith(0.75)
  })

  it('drives the engine pitch from the pitch slider', async () => {
    const { engine } = renderShell()
    await importTrack()

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
    const { engine } = renderShell()
    await importTrack()

    act(() => engine.emit(5))
    fireEvent.click(screen.getByRole('button', { name: '+ Repère' }))

    const goto = screen.getByRole('button', { name: 'Aller à Repère 1' })
    fireEvent.click(goto)
    expect(engine.seekTo).toHaveBeenCalledWith(5)

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer Repère 1' }))
    expect(
      screen.queryByRole('button', { name: 'Aller à Repère 1' })
    ).not.toBeInTheDocument()
  })

  it('clears markers when a new track is loaded', async () => {
    renderShell()
    await importTrack()

    fireEvent.click(screen.getByRole('button', { name: '+ Repère' }))
    expect(
      screen.getByRole('button', { name: 'Aller à Repère 1' })
    ).toBeInTheDocument()

    await importTrack()
    expect(
      screen.queryByRole('button', { name: 'Aller à Repère 1' })
    ).not.toBeInTheDocument()
  })

  it('disables marker controls until a track is loaded', () => {
    renderShell()
    expect(screen.getByRole('button', { name: '+ Repère' })).toBeDisabled()
  })

  it('seeks the engine when the waveform is clicked', async () => {
    const { engine } = renderShell()
    await importTrack()

    // A press-release at the same x is a click → seek to 50% of a 10 s timeline.
    pointerGesture(50, 50)
    expect(engine.seekTo).toHaveBeenCalledWith(5)
  })

  it('drag-selects an A/B loop, names it via the editor, and recalls it', async () => {
    const { engine } = renderShell({ loopStore: fakeLoopStore() })
    await importTrack()

    // Drag 20%→60% of a 10 s timeline → loop [2s, 6s].
    pointerGesture(20, 60)

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la boucle' }))
    fireEvent.change(screen.getByLabelText('Nom'), {
      target: { value: 'Mon passage' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    const recall = await screen.findByRole('button', { name: 'Mon passage' })
    fireEvent.click(recall)
    expect(engine.seekTo).toHaveBeenCalledWith(2)
  })

  it('edits a saved loop in place when its handle moves (no re-save prompt)', async () => {
    renderShell({ loopStore: fakeLoopStore() })
    await importTrack()

    // Select [2 s, 6 s] and save it.
    pointerGesture(20, 60)
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la boucle' }))
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Pont' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(
      screen.queryByRole('button', { name: 'Enregistrer la boucle' })
    ).not.toBeInTheDocument()

    // Drag the end handle inward: the saved loop updates rather than spawning a
    // duplicate, so no « Enregistrer » reappears and there is still one chip.
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

  it('wraps playback at the loop end only while looping is enabled', async () => {
    const { engine } = renderShell()
    await importTrack()

    // Drag 20%→60% of a 10 s timeline → loop [2 s, 6 s], looping armed.
    pointerGesture(20, 60)
    act(() => engine.emit(6))
    expect(engine.seekTo).toHaveBeenLastCalledWith(2)

    // Turn looping off: the same overshoot must now play straight through.
    fireEvent.click(screen.getByRole('button', { name: /Boucle active/ }))
    engine.seekTo.mockClear()
    act(() => engine.emit(7))
    expect(engine.seekTo).not.toHaveBeenCalled()
  })

  it('shows the file tags in the header once read', async () => {
    const reader: TrackMetadataReader = {
      read: async () => ({ title: 'Nocturne', artist: 'Lena Vasquez' })
    }
    renderShell({ metadataReader: reader })
    await importTrack()

    expect(await screen.findByText('Nocturne')).toBeInTheDocument()
    expect(screen.getByText('Lena Vasquez')).toBeInTheDocument()
  })

  it('falls back to the file name when the file has no tags', async () => {
    renderShell()
    await importTrack()

    // "take.wav" → "take" (extension stripped), no fake title applied.
    expect(screen.getByText('take')).toBeInTheDocument()
  })

  it('separates the loaded track on demand and lists the stems', async () => {
    renderShell({ separator: fakeSeparator() })

    // The action is disabled until a track is loaded.
    expect(
      screen.getByRole('button', { name: 'Séparer les pistes' })
    ).toBeDisabled()

    await importTrack()
    fireEvent.click(screen.getByRole('button', { name: 'Séparer les pistes' }))

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
    renderShell({ separator: failingSeparator })
    await importTrack()

    fireEvent.click(screen.getByRole('button', { name: 'Séparer les pistes' }))

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
  async function saveProjectAs(name: string): Promise<void> {
    fireEvent.click(
      screen.getByRole('button', { name: 'Enregistrer le projet' })
    )
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: name } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    // The one-click re-save appears once the project exists.
    await screen.findByRole('button', { name: 'Renommer le projet' })
  }

  it('surfaces a failed save as a dismissible alert banner', async () => {
    renderShell({ projectStores: brokenProjectStores() })
    await importTrack()

    fireEvent.click(
      screen.getByRole('button', { name: 'Enregistrer le projet' })
    )
    fireEvent.change(screen.getByLabelText('Nom'), {
      target: { value: 'Mon projet' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      "Impossible d'enregistrer le projet : server down"
    )

    fireEvent.click(screen.getByRole('button', { name: "Fermer l'alerte" }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('re-saves an existing project in one click, keeping a rename popover', async () => {
    renderShell({ projectStores: fakeProjectStores() })
    await importTrack()
    await saveProjectAs('Mon projet')

    // One direct click — no popover asks for the name again.
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(screen.queryByLabelText('Nom')).not.toBeInTheDocument()

    // Still a single project, under the same name.
    fireEvent.click(screen.getByRole('button', { name: 'Projets' }))
    expect(await screen.findByText('Mon projet')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Ouvrir' })).toHaveLength(1)
  })

  it('detaches the session from the saved project when a new file is imported', async () => {
    renderShell({ projectStores: fakeProjectStores() })
    await importTrack()
    await saveProjectAs('Premier morceau')

    // A new import starts a fresh session — the header must offer a first
    // save (name popover), not a one-click re-save onto the old project.
    await importTrack()

    expect(
      screen.getByRole('button', { name: 'Enregistrer le projet' })
    ).toBeInTheDocument()
  })

  it('saves the re-imported session as a second project, not over the first', async () => {
    renderShell({ projectStores: fakeProjectStores() })
    await importTrack()
    await saveProjectAs('Premier morceau')

    await importTrack()
    await saveProjectAs('Deuxième morceau')

    fireEvent.click(screen.getByRole('button', { name: 'Projets' }))
    expect(
      await screen.findAllByRole('button', { name: 'Ouvrir' })
    ).toHaveLength(2)
  })

  it('asks before opening a project over the loaded session', async () => {
    renderShell({ projectStores: fakeProjectStores() })
    await importTrack()
    await saveProjectAs('Mon projet')

    fireEvent.click(screen.getByRole('button', { name: 'Projets' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir' }))

    // The session would be replaced — the row asks for a confirmation first.
    expect(
      screen.getByText('La session actuelle sera remplacée')
    ).toBeInTheDocument()
    fireEvent.click(
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

  it('says the server is unreachable when the projects listing fails', async () => {
    renderShell({ projectStores: brokenProjectStores() })

    fireEvent.click(screen.getByRole('button', { name: 'Projets' }))

    expect(
      await screen.findByText(
        'Serveur injoignable — vérifie que le serveur local est lancé'
      )
    ).toBeInTheDocument()
  })
})
