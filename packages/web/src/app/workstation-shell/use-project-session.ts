import {
  type LoopRegion,
  type MixerChannel,
  type MixerState,
  type Project,
  type ProjectChordChart,
  type ProjectDeps,
  type ProjectTempo,
  type ProjectTuning,
  projectChordChart,
  type TrackSourceMetadata
} from '@app/core'
import { type ChangeEvent, useRef, useState } from 'react'
import { sessionSignature } from '../../projects/session-signature.ts'
import { type Projects, useProjects } from '../../projects/use-projects.ts'
import { isSyntheticStem } from '../mixer/synthetic-stem.ts'
import {
  DEFAULT_METRONOME_CHANNEL,
  METRONOME_ID
} from '../tempo/metronome-stem.ts'
import {
  restoreSession,
  type SessionRestoreDeps,
  sessionSaveInput
} from './project-session.ts'

/** A file name without its extension, the fallback header title. */
function trackTitle(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

export interface ProjectSessionDeps extends SessionRestoreDeps {
  readonly stores?: ProjectDeps | undefined
  /** The imported file's original bytes — what a save persists as the source. */
  readonly loadedBytes: ArrayBuffer | undefined
  readonly metadata: {
    readonly title: string | undefined
    readonly artist: string | undefined
  }
  readonly stemsReady: boolean
  /** The armed A/B region and its wrap choice — the loupe a save keeps. */
  readonly loopRegion: LoopRegion | undefined
  readonly loopEnabled: boolean
  /** The live playback tuning (tempo/pitch/zoom) — saved and fingerprinted. */
  readonly tuning: ProjectTuning
  /** The chord chart's session state — saved, fingerprinted, reset on import. */
  readonly chordChart: {
    readonly source: string
    /** How far the grid's key has been transposed from its written key. */
    readonly transposedBy: number
    readonly reset: () => void
  }
  readonly viewport: { readonly reset: () => void }
  /** Called when an open actually starts restoring — closes the dialog. */
  readonly onRestoreStarted: () => void
  /** Called with the restored project once an open has rebuilt the session. */
  readonly onRestored?: (project: Project) => void
  /** Called when a fresh user import begins (never on an open's re-import). */
  readonly onFreshImport?: () => void
  /** Called with the project name once a save has actually persisted. */
  readonly onSaved?: (name: string) => void
}

export interface ProjectSession {
  readonly projects: Projects
  /** The display name of the loaded track (file title or project name). */
  readonly trackName: string | null
  /** The project an open is rebuilding right now, driving the busy row. */
  readonly openingId: string | undefined
  /** The saved project the session maps to — what a re-save overwrites. */
  readonly currentProject: Project | undefined
  /** Whether the session holds changes its saved project does not. */
  readonly dirty: boolean
  /**
   * Whether discarding the session would lose work: changes a saved project
   * does not hold, or a loaded track no saved project holds at all. The one
   * predicate every destructive path (import, reload, project open) guards on.
   */
  readonly unsavedWork: boolean
  readonly handleSave: (name: string) => void
  readonly handleOpen: (id: string) => Promise<void>
  readonly onFilePicked: (event: ChangeEvent<HTMLInputElement>) => void
  /**
   * Import a dropped OS file: the same detach-and-refresh path as the picker,
   * driven by a `File` (a drag never touches the hidden input).
   */
  readonly importPickedFile: (file: File) => void
  /**
   * Import a track fetched from a URL: same detach-and-refresh path as a picked
   * file, seeding the title from the source metadata, then decoding the bytes.
   */
  readonly importDownloaded: (
    bytes: ArrayBuffer,
    metadata: TrackSourceMetadata
  ) => void
}

/**
 * Smart hook owning the project ↔ session lifecycle: importing a new file
 * detaches the session from the saved project (a save must mint a fresh one),
 * opening a project rebuilds the whole session, and a stale open that resolves
 * after the user moved on to a new import is discarded instead of clobbering it.
 */
export function useProjectSession(deps: ProjectSessionDeps): ProjectSession {
  const projects = useProjects(deps.stores)
  const [trackName, setTrackName] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | undefined>(undefined)
  // The fingerprint of what the current project last saved/loaded — comparing
  // it to the live session's is what the « Enregistré » read-out shows.
  const [savedSignature, setSavedSignature] = useState<string | undefined>(
    undefined
  )
  // Bumped by every new import; a project open that resolves after the user
  // moved on to a fresh file must not clobber that session (the projects
  // dialog stays dismissible while an open is in flight).
  const sessionEpochRef = useRef(0)

  /**
   * A new track gets a fresh timeline — the old markers don't belong to it,
   * the view should start fully zoomed out, and any prior stems are stale.
   */
  function startFreshTrack(name: string): void {
    deps.loops.clear()
    deps.markers.clear()
    deps.viewport.reset()
    deps.separation.reset()
    deps.mixer.reset()
    deps.tempo.reset()
    deps.metronome.reset()
    deps.chordChart.reset()
    setTrackName(name)
  }

  /**
   * The mixer as a save persists it: the separation channels only. The
   * metronome (and the un-split « Piste ») are synthetic stems that ride the
   * same mixer but are never part of the saved separation — the audio behind
   * them is re-synthesised, not stored.
   */
  function separationMixer(): MixerState {
    return deps.mixer.state.filter((channel) => !isSyntheticStem(channel.id))
  }

  /** The metronome's live mixer channel, once the click has been seated. */
  function metronomeChannel(): MixerChannel | undefined {
    return deps.mixer.state.find((channel) => channel.id === METRONOME_ID)
  }

  /**
   * The tempo half of the session as a save persists it: the detected analysis
   * plus the metronome's live mixer settings. Present only once a tempo is known.
   */
  function liveTempo(): ProjectTempo | undefined {
    const analysis = deps.tempo.analysis
    if (analysis === undefined) {
      return undefined
    }
    return {
      bpm: analysis.bpm,
      grid: analysis.grid,
      beatsPerBar: analysis.beatsPerBar,
      metronome: metronomeChannel() ?? DEFAULT_METRONOME_CHANNEL,
      octaveShift: deps.tempo.octaveShift,
      ...(deps.tempo.manual === undefined ? {} : { manual: deps.tempo.manual })
    }
  }

  /**
   * The chart as a save persists it: the raw text, present only once the user
   * typed something real (whitespace alone is no chart — absent ⇔ empty, so
   * old manifests and blank sessions sign the same).
   */
  function liveChordChart(): ProjectChordChart | undefined {
    // The core builder owns the manifest shape (absent ⇔ empty, absent ⇔ 0),
    // mirroring `chartTransposedBy` on the read side.
    return projectChordChart(
      deps.chordChart.source,
      deps.chordChart.transposedBy
    )
  }

  /** The live session's persisted-state fingerprint (heavy audio excluded). */
  function liveSignature(): string {
    // Sign the metronome on the SAME condition a save persists it (a known
    // tempo, via `liveTempo`), so the two sides never disagree on whether a
    // metronome is part of the session.
    const tempo = liveTempo()
    return sessionSignature({
      loops: deps.loops.library,
      markers: deps.markers.markers,
      activeLoop:
        deps.loopRegion === undefined
          ? undefined
          : { region: deps.loopRegion, enabled: deps.loopEnabled },
      tuning: deps.tuning,
      tempo: tempo
        ? {
            metronome: tempo.metronome,
            octaveShift: deps.tempo.octaveShift,
            manual: deps.tempo.manual,
            beatsPerBar: tempo.beatsPerBar,
            grid: tempo.grid
          }
        : undefined,
      chordChart: liveChordChart(),
      separation: deps.stemsReady ? { mixer: separationMixer() } : undefined
    })
  }

  /** Persist the whole session under a name — bytes, loops, markers, stems. */
  function handleSave(name: string): void {
    if (!deps.loadedBytes) {
      return
    }
    const tempo = liveTempo()
    const chordChart = liveChordChart()
    const input = sessionSaveInput({
      bytes: deps.loadedBytes,
      title: deps.metadata.title ?? trackName ?? undefined,
      artist: deps.metadata.artist,
      loops: deps.loops.library,
      markers: deps.markers.markers,
      tuning: deps.tuning,
      ...(tempo === undefined ? {} : { tempo }),
      ...(chordChart === undefined ? {} : { chordChart }),
      ...(deps.loopRegion === undefined
        ? {}
        : {
            activeLoop: {
              region: deps.loopRegion,
              enabled: deps.loopEnabled
            }
          }),
      ...(deps.stemsReady
        ? {
            separation: {
              sources: deps.separation.sources,
              mixer: separationMixer()
            }
          }
        : {})
    })
    void projects.save(name, input).then((saved) => {
      if (saved) {
        // Sign what was actually persisted — the session now matches it.
        setSavedSignature(sessionSignature(saved))
        deps.onSaved?.(saved.name)
      }
    })
  }

  /** Rebuild the whole session from a saved project. */
  async function handleOpen(id: string): Promise<void> {
    const epoch = sessionEpochRef.current
    setOpeningId(id)
    try {
      const result = await projects.open(id)
      // A new file was imported while the open was in flight — the user moved
      // on; restoring now would silently discard what they just picked.
      if (!result.ok || sessionEpochRef.current !== epoch) {
        return
      }
      deps.onRestoreStarted()
      // Same clean slate as a fresh import, then re-import the stored bytes.
      startFreshTrack(result.project.name)
      await restoreSession(result, deps)
      // The rebuilt session mirrors the manifest — sign it as the saved state.
      setSavedSignature(sessionSignature(result.project))
      deps.onRestored?.(result.project)
    } finally {
      setOpeningId(undefined)
    }
  }

  /**
   * The shared prelude every fresh import runs before decoding: detach from the
   * saved project (a save must mint a new one), forget the saved fingerprint,
   * re-enable auto-detect, and clear the timeline under the new title.
   */
  function beginImport(name: string): void {
    // Detach: saving the new track must not overwrite the open project.
    sessionEpochRef.current += 1
    projects.detach()
    setSavedSignature(undefined)
    // A fresh import must auto-detect: clear any pending open-restore guard.
    deps.setSuppressAutoDetect(false)
    deps.onFreshImport?.()
    startFreshTrack(name)
  }

  function importPickedFile(file: File): void {
    beginImport(trackTitle(file.name))
    void deps.importFile(file)
  }

  function onFilePicked(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    if (file) {
      importPickedFile(file)
    }
    // Clear it so re-picking the same file fires `change` again.
    event.target.value = ''
  }

  function importDownloaded(
    bytes: ArrayBuffer,
    metadata: TrackSourceMetadata
  ): void {
    const title = metadata.title.trim() || 'Sans titre'
    beginImport(title)
    // Reuse the exact file-decode path: wrap the fetched bytes as a File so the
    // player decodes them and reads any embedded tags just like a picked file.
    // The source's own title/artist (e.g. the uploader) seed the header when the
    // downloaded file carries no embedded tags.
    const file = new File([bytes], `${title}.m4a`, { type: 'audio/mp4' })
    void deps.importFile(file, { title, artist: metadata.artist })
  }

  const currentProject = projects.projects.find(
    (p) => p.id === projects.currentId
  )

  // Dirty = the session drifted from its saved project. Muted while an open
  // is still rebuilding (the live state settles asynchronously). Signing is
  // the last conjunct so a detached session never pays for it.
  const dirty =
    currentProject !== undefined &&
    savedSignature !== undefined &&
    openingId === undefined &&
    liveSignature() !== savedSignature

  return {
    projects,
    trackName,
    openingId,
    currentProject,
    dirty,
    // With a saved project, drift is what a discard would lose; without one,
    // the loaded track itself lives only in this session.
    unsavedWork:
      openingId === undefined &&
      (currentProject !== undefined ? dirty : deps.loadedBytes !== undefined),
    handleSave,
    handleOpen,
    onFilePicked,
    importPickedFile,
    importDownloaded
  }
}
