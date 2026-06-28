// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type {
  AudioFileDecoder,
  DecodedAudio,
  LoopLibrary,
  LoopStore,
  PlaybackEngine
} from '@app/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    const engine = fakeEngine()
    render(<WorkstationShell decoder={okDecoder} engine={engine} />)

    expect(screen.getByRole('button', { name: 'Lecture' })).toBeDisabled()

    await importTrack()

    expect(screen.getByRole('button', { name: 'Lecture' })).toBeEnabled()
    expect(screen.getByText('0:10')).toBeInTheDocument()
  })

  it('surfaces a decode failure as an alert', async () => {
    const engine = fakeEngine()
    const decoder: AudioFileDecoder = {
      decode: async () => {
        throw new Error('unsupported format')
      }
    }
    render(<WorkstationShell decoder={decoder} engine={engine} />)

    fireEvent.change(screen.getByLabelText('Importer un fichier audio'), {
      target: { files: [audioFile()] }
    })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('unsupported format')
    })
  })

  it('plays and pauses via the transport button, driving the engine', async () => {
    const engine = fakeEngine()
    render(<WorkstationShell decoder={okDecoder} engine={engine} />)
    await importTrack()

    fireEvent.click(screen.getByRole('button', { name: 'Lecture' }))
    expect(engine.play).toHaveBeenCalledOnce()

    const pauseButton = screen.getByRole('button', { name: 'Pause' })
    fireEvent.click(pauseButton)
    expect(engine.pause).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Lecture' })).toBeInTheDocument()
  })

  it('reflects the engine position as a timecode', async () => {
    const engine = fakeEngine()
    render(<WorkstationShell decoder={okDecoder} engine={engine} />)
    await importTrack()

    act(() => engine.emit(5))
    expect(screen.getByText('0:05')).toBeInTheDocument()
  })

  it('toggles playback with the Space key', async () => {
    const engine = fakeEngine()
    render(<WorkstationShell decoder={okDecoder} engine={engine} />)
    await importTrack()

    fireEvent.keyDown(document.body, { code: 'Space' })
    expect(engine.play).toHaveBeenCalledOnce()
  })

  it('drives the engine tempo from the tempo slider', async () => {
    const engine = fakeEngine()
    render(<WorkstationShell decoder={okDecoder} engine={engine} />)
    await importTrack()

    fireEvent.change(screen.getByLabelText('Tempo en pourcentage'), {
      target: { value: '75' }
    })
    // 75 % → ratio 0.75.
    expect(engine.setTimeRatio).toHaveBeenCalledWith(0.75)
  })

  it('drives the engine pitch from the pitch slider', async () => {
    const engine = fakeEngine()
    render(<WorkstationShell decoder={okDecoder} engine={engine} />)
    await importTrack()

    fireEvent.change(screen.getByLabelText('Hauteur en demi-tons'), {
      target: { value: '5' }
    })
    expect(engine.setPitchSemitones).toHaveBeenCalledWith(5)
  })

  it('disables the tempo and pitch sliders until a track is loaded', () => {
    const engine = fakeEngine()
    render(<WorkstationShell decoder={okDecoder} engine={engine} />)
    expect(screen.getByLabelText('Tempo en pourcentage')).toBeDisabled()
    expect(screen.getByLabelText('Hauteur en demi-tons')).toBeDisabled()
  })

  it('adds a marker at the playhead and seeks back to it', async () => {
    const engine = fakeEngine()
    render(<WorkstationShell decoder={okDecoder} engine={engine} />)
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
    const engine = fakeEngine()
    render(<WorkstationShell decoder={okDecoder} engine={engine} />)
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
    const engine = fakeEngine()
    render(<WorkstationShell decoder={okDecoder} engine={engine} />)
    expect(screen.getByRole('button', { name: '+ Section' })).toBeDisabled()
  })

  it('seeks the engine when the waveform is clicked', async () => {
    const engine = fakeEngine()
    render(<WorkstationShell decoder={okDecoder} engine={engine} />)
    await importTrack()

    const surface = waveformSurface()
    surface.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect
    // A press-release at the same x is a click → seek to 50% of a 10 s timeline.
    fireEvent.pointerDown(surface, { button: 0, clientX: 50 })
    fireEvent.pointerUp(surface, { button: 0, clientX: 50 })
    expect(engine.seekTo).toHaveBeenCalledWith(5)
  })

  it('drag-selects an A/B loop, saves it, and recalls it', async () => {
    const engine = fakeEngine()
    const prompt = vi
      .spyOn(window, 'prompt')
      .mockReturnValue('Mon passage')
    render(
      <WorkstationShell decoder={okDecoder} engine={engine} loopStore={fakeLoopStore()} />
    )
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
})
