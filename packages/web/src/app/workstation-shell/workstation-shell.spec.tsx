// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type {
  AudioFileDecoder,
  DecodedAudio,
  LoopLibrary,
  LoopStore,
  PlaybackEngine,
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
import { vi } from 'vitest'
import { WorkstationShell } from './workstation-shell.tsx'

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

function audioFile(): File {
  return new File([new Uint8Array([1, 2, 3, 4])], 'take.wav', { type: 'audio/wav' })
}

/** A tagless reader — keeps tests off the real music-metadata parser. */
const silentReader: TrackMetadataReader = {
  read: async () => ({ title: undefined, artist: undefined })
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
  return screen.getByRole('button', { name: /Forme d'onde/ })
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
      metadataReader={silentReader}
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
    render(<WorkstationShell />)
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('exposes the analysis tabs', () => {
    render(<WorkstationShell />)
    expect(screen.getByRole('tab', { name: 'Spectre' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Repères' })).toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: '+ Section' }))

    const goto = screen.getByRole('button', { name: 'Aller à Section 1' })
    fireEvent.click(goto)
    expect(engine.seekTo).toHaveBeenCalledWith(5)

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer Section 1' }))
    expect(
      screen.queryByRole('button', { name: 'Aller à Section 1' })
    ).not.toBeInTheDocument()
  })

  it('clears markers when a new track is loaded', async () => {
    renderShell()
    await importTrack()

    fireEvent.click(screen.getByRole('button', { name: '+ Section' }))
    expect(
      screen.getByRole('button', { name: 'Aller à Section 1' })
    ).toBeInTheDocument()

    await importTrack()
    expect(
      screen.queryByRole('button', { name: 'Aller à Section 1' })
    ).not.toBeInTheDocument()
  })

  it('disables marker controls until a track is loaded', () => {
    renderShell()
    expect(screen.getByRole('button', { name: '+ Section' })).toBeDisabled()
  })

  it('seeks the engine when the waveform is clicked', async () => {
    const { engine } = renderShell()
    await importTrack()

    const surface = waveformSurface()
    surface.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect
    // A press-release at the same x is a click → seek to 50% of a 10 s timeline.
    fireEvent.pointerDown(surface, { button: 0, clientX: 50 })
    fireEvent.pointerUp(surface, { button: 0, clientX: 50 })
    expect(engine.seekTo).toHaveBeenCalledWith(5)
  })

  it('drag-selects an A/B loop, saves it, and recalls it', async () => {
    const prompt = vi
      .spyOn(window, 'prompt')
      .mockReturnValue('Mon passage')
    const { engine } = renderShell({ loopStore: fakeLoopStore() })
    await importTrack()

    const surface = waveformSurface()
    surface.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect
    // Drag 20%→60% of a 10 s timeline → loop [2s, 6s].
    fireEvent.pointerDown(surface, { button: 0, clientX: 20 })
    fireEvent.pointerUp(surface, { button: 0, clientX: 60 })

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la boucle' }))
    const recall = await screen.findByRole('button', { name: 'Mon passage' })

    fireEvent.click(recall)
    expect(engine.seekTo).toHaveBeenCalledWith(2)
    prompt.mockRestore()
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
})
