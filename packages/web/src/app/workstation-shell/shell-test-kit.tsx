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
import { SeparationError } from '@app/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { WorkstationShell } from './workstation-shell.tsx'


/** 10 samples at 1 Hz → a 10-second timeline, easy to read as 0:10. */
export const decoded: DecodedAudio = {
  sampleRate: 1,
  channels: [[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]]
}

const okDecoder: AudioFileDecoder = { decode: async () => decoded }

/** Positioned beats (four to the bar) at the given instants — a fake detector's. */
export function beatsAt(times: readonly number[]) {
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
    unload: vi.fn(),
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
export function fakeStemEngine(): StemPlaybackEngine {
  // The engine is the stems' PCM custodian: remember what load/addStem handed
  // over so `stemAudio` serves it back, as the real engine's buffers do.
  const loaded = new Map<string, DecodedAudio>()
  return {
    load: vi.fn(async (stems) => {
      loaded.clear()
      for (const stem of stems) {
        loaded.set(stem.id, stem.audio)
      }
    }),
    addStem: vi.fn(async (stem) => {
      loaded.set(stem.id, stem.audio)
    }),
    removeStem: vi.fn((id) => {
      loaded.delete(id)
    }),
    play: vi.fn(),
    pause: vi.fn(),
    seekTo: vi.fn(),
    setTimeRatio: vi.fn(),
    setPitchSemitones: vi.fn(),
    setGain: vi.fn(),
    stemAudio: (id) => loaded.get(id),
    onPositionChange: () => () => {}
  }
}

export function audioFile(name = 'take.wav'): File {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type: 'audio/wav' })
}

/** A tagless reader — keeps tests off the real music-metadata parser. */
const silentReader: TrackMetadataReader = {
  read: async () => ({ title: undefined, artist: undefined })
}

/** Immediate fake separator: emits one progress event, returns two stems. */
export function fakeSeparator(): StemSeparator {
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
export function fakeTrackSource(
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
export const failingSeparator: StemSeparator = {
  separate: async () => {
    // Typed like the real adapter (M1.4): the code drives the copy the
    // shell shows; the detail only ever reaches the console.
    throw new SeparationError('network', 'moteur injoignable')
  }
}

/** In-memory project stores so tests never reach the local server. */
export function fakeProjectStores(): ProjectDeps {
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
export function brokenProjectStores(): ProjectDeps {
  const fail = async () => {
    throw new Error('server down')
  }
  return {
    store: { list: fail, load: fail, save: fail, delete: fail },
    audio: { put: fail, get: fail }
  }
}

/** A health probe stub answering with the given device (or unreachable). */
export function healthFetch(device: string | null | 'unreachable'): typeof fetch {
  return (async () => {
    if (device === 'unreachable') {
      throw new TypeError('fetch failed')
    }
    return { ok: true, json: async () => ({ device }) } as Response
  }) as typeof fetch
}

/** The waveform gesture surface (click to seek, drag to loop). */
export function waveformSurface(): HTMLElement {
  return screen.getByTestId('waveform-surface')
}

/**
 * Drive a pointer gesture on the waveform. Ratios are measured against the
 * positioning container (the surface's parent), which we size to 100px.
 * Kept on fireEvent: coordinate-based gestures need explicit clientX values.
 */
export function pointerGesture(
  fromX: number,
  toX: number,
  options: { readonly altKey?: boolean } = {}
): void {
  const surface = waveformSurface()
  const container = surface.parentElement as HTMLElement
  container.getBoundingClientRect = () => ({ left: 0, width: 100 }) as DOMRect
  fireEvent.pointerDown(surface, { button: 0, clientX: fromX })
  fireEvent.pointerUp(container, { button: 0, clientX: toX, ...options })
}

/** Render the shell with the default fakes; override any port per test. */
export function renderShell(
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

export async function importTrack(user: UserEvent, fileName?: string): Promise<void> {
  await user.upload(
    screen.getByLabelText(i18n._('header.import-file')),
    audioFile(fileName)
  )
  // Wait on the waveform surface (present in the loaded state for both the track
  // and the summed-mix image) — the track image is transient once a resolving
  // tempo detector loads the metronome and the view switches to the mix.
  await waitFor(() => {
    expect(screen.getByTestId('waveform-surface')).toBeInTheDocument()
  })
}

/**
 * The chord-source editor, unfolded on demand: the panel shows the chart
 * alone by default (P.3) — reading or typing the source first means opening
 * the editor behind « Modifier ». Idempotent: an already-open editor is
 * returned as-is (the toggle would fold it back).
 */
export async function chartEditor(user: UserEvent): Promise<HTMLElement> {
  const existing = screen.queryByLabelText(i18n._('chords.input-label'))
  if (existing) {
    return existing
  }
  await user.click(screen.getByRole('button', { name: i18n._('chords.edit') }))
  return screen.getByLabelText(i18n._('chords.input-label'))
}

/** Drag 20%→60% of the 10 s timeline and save the region as a named loop. */
export async function saveNamedLoop(user: UserEvent, name: string): Promise<void> {
  pointerGesture(20, 60)
  await user.click(screen.getByRole('button', { name: i18n._('loops.save-region') }))
  await user.type(screen.getByLabelText(i18n._('common.name')), name)
  await user.click(screen.getByRole('button', { name: i18n._('common.save') }))
}

/** Open the sidebar « Boucles » tab where the saved-loop library lives. */
export async function openLoops(user: UserEvent): Promise<void> {
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
export async function openProjectsDialog(user: UserEvent): Promise<void> {
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
export function savedLoop(name: string): RegExp {
  return new RegExp(`^(?!Renommer|Supprimer).*${name}$`)
}

/* The tempo read-out is mirrored into a visually-hidden live region for screen
 * readers; these queries assert the VISIBLE read-out, so skip that channel. */
/** Wait for the tempo read-out (the editable BPM field) to show `bpm`. */
export async function expectBpmReadout(bpm: number): Promise<void> {
  await waitFor(() =>
    expect(
      screen.getByRole('spinbutton', { name: i18n._('tempo.bpm-field') })
    ).toHaveValue(bpm)
  )
}

/**
 * Three taps half a second apart (→ 120 BPM) with the wall clock mocked; the
 * actuation is injected so the panel button and the T key share one
 * choreography.
 */
export async function tapThrice(actuate: () => void | Promise<void>): Promise<void> {
  const clock = vi.spyOn(performance, 'now')
  clock.mockReturnValue(0)
  await actuate()
  clock.mockReturnValue(500)
  await actuate()
  clock.mockReturnValue(1000)
  await actuate()
  clock.mockRestore()
}

// jsdom implements neither pointer-capture method; the waveform calls both.
// The chord panel reads its bars-per-row preference from localStorage at
// every mount — never let one test's layout leak into the next.
// Picker tests spy on prototypes (input click, anchor click) — restore even
// when an assertion failed mid-test, so no spy (or its counts) leaks onward.
/** Register the shared shell hooks; call once at the top of each spec file. */
export function installShellHooks(): void {
  beforeAll(() => {
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  })
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.restoreAllMocks()
  })
}

/** First save through the header popover, under the given name. */
export async function saveProjectAs(user: UserEvent, name: string): Promise<void> {
  await user.click(
    screen.getByRole('button', { name: i18n._('header.save-project') })
  )
  await user.clear(screen.getByLabelText(i18n._('common.name')))
  await user.type(screen.getByLabelText(i18n._('common.name')), name)
  await user.click(screen.getByRole('button', { name: i18n._('common.save') }))
  // The one-click re-save appears once the project exists.
  await screen.findByRole('button', { name: i18n._('header.rename-project') })
}
