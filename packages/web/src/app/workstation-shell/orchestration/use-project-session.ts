import {
  type LoopRegion,
  type MixerChannel,
  type MixerState,
  type Project,
  type ProjectChordChart,
  type ProjectDeps,
  type ProjectTempo,
  projectChordChart,
  sessionSaveInput,
  sessionSignature,
  type TrackSourceMetadata
} from '@app/core'
import { useAtomValue } from 'jotai'
import { type ChangeEvent, useRef, useState } from 'react'
import { nextPaint } from '../../../lib/next-paint.ts'
import { type Projects, useProjects } from '../../../projects/use-projects.ts'
import { useAudioSession } from '../../audio-session/audio-session.ts'
import { useChordChart } from '../../lead-sheet/use-chord-chart.ts'
import { isSyntheticStem, METRONOME_ID } from '../../mixer/synthetic-stem.ts'
import type { Mixer } from '../../mixer/use-mixer.ts'
import { DEFAULT_METRONOME_CHANNEL } from '../../tempo/metronome-stem.ts'
import { loadedBytesAtom, trackMetadataAtom } from '../../track/track-atoms.ts'
import { tuningAtom } from '../../waveform/player-atoms.ts'
import { useViewport } from '../../waveform/use-viewport.ts'
import { restoreSession, type SessionRestoreDeps } from './project-session.ts'

/** A file name without its extension, the fallback header title. */
function trackTitle(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

export interface ProjectSessionDeps
  extends Omit<SessionRestoreDeps, 'restoreChordChart' | 'onRestoreStep'> {
  /** Restore for the open path, plus the snapshot/reset a save and a fresh
   * import need — still never the 12-member facade. */
  readonly mixer: Pick<Mixer, 'restore' | 'reset' | 'state'>
  readonly stores?: ProjectDeps | undefined
  readonly stemsReady: boolean
  /** The armed A/B region and its wrap choice — the loupe a save keeps. */
  readonly loopRegion: LoopRegion | undefined
  readonly loopEnabled: boolean
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
  /** Where the open's stem rebuild stands (« Piste n/total »), while the
   * stored WAVs decode — undefined outside that stretch (AS.4). */
  readonly openingStem: { stem: number; total: number } | undefined
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
  /** Whether a save is being ENCODED (before the store's own busy state). */
  readonly preparingSave: boolean
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
  // The stores are a session port (ADR 0011): an explicit arg (tests) wins,
  // then the session's injection, then the real stores inside useProjects.
  const session = useAudioSession()
  const projects = useProjects(deps.stores ?? session.projectStores)
  // The chart is the feature's own session atom (ADR 0010) — derived here for
  // the save/fingerprint/reset lifecycle instead of threaded through the shell.
  const chordChart = useChordChart()
  // The loaded track's bytes and tags are the track feature's atoms (ADR
  // 0010): a save persists them, and the tags title the project.
  const loadedBytes = useAtomValue(loadedBytesAtom)
  const metadata = useAtomValue(trackMetadataAtom)
  // The live tuning (tempo/pitch/zoom/fine-tune) is the player's derived atom
  // (ADR 0010): a save persists it and the fingerprint signs it.
  const tuning = useAtomValue(tuningAtom)
  // A fresh track starts fully zoomed out: the zoom is the viewport feature's
  // atom (ADR 0010), so this hook wears it rather than receiving a reset.
  const viewport = useViewport()
  const [trackName, setTrackName] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | undefined>(undefined)
  // The restore's stem-decode narration (« Piste n/total »), for the chip.
  const [openingStem, setOpeningStem] = useState<
    { stem: number; total: number } | undefined
  >(undefined)
  // Encoding the stems for a save freezes the thread — the header narrates it.
  const [preparingSave, setPreparingSave] = useState(false)
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
    viewport.reset()
    deps.separation.reset()
    deps.mixer.reset()
    deps.tempo.reset()
    deps.metronome.reset()
    chordChart.reset()
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
    return projectChordChart(chordChart.source, chordChart.transposedBy)
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
      tuning,
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
  async function handleSave(name: string): Promise<void> {
    if (!loadedBytes) {
      return
    }
    // The stems' WAV re-encode below is synchronous: paint the busy line
    // FIRST or the chip appears only after the freeze (R.4).
    setPreparingSave(true)
    await nextPaint()
    const tempo = liveTempo()
    const chordChart = liveChordChart()
    const input = sessionSaveInput({
      bytes: loadedBytes,
      title: metadata.title ?? trackName ?? undefined,
      artist: metadata.artist,
      loops: deps.loops.library,
      markers: deps.markers.markers,
      tuning,
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
    setPreparingSave(false)
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
      // Restores stay silent by design — the unwrapped `restore` seats the
      // persisted chart without firing the user-edit marker sync.
      await restoreSession(result, {
        ...deps,
        restoreChordChart: chordChart.restore,
        onRestoreStep: setOpeningStem
      })
      // Re-check the epoch: a fresh import that landed DURING the restore
      // superseded it (restoreSession bailed) — signing the old project or
      // seating its fold would mislabel the track the user now looks at.
      if (sessionEpochRef.current !== epoch) {
        return
      }
      // The rebuilt session mirrors the manifest — sign it as the saved state.
      setSavedSignature(sessionSignature(result.project))
      deps.onRestored?.(result.project)
    } finally {
      setOpeningId(undefined)
      setOpeningStem(undefined)
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
    openingStem,
    currentProject,
    dirty,
    // With a saved project, drift is what a discard would lose; without one,
    // the loaded track itself lives only in this session.
    unsavedWork:
      openingId === undefined &&
      (currentProject !== undefined ? dirty : loadedBytes !== undefined),
    handleSave,
    preparingSave,
    handleOpen,
    onFilePicked,
    importPickedFile,
    importDownloaded
  }
}
