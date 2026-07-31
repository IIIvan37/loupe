import { Trans } from '@lingui/react/macro'
import { combineWaveforms } from '@app/core'
import { useAtomValue } from 'jotai'
import { useMemo } from 'react'
import { usePlayerHandle } from '../../audio-session/audio-session.ts'
import { StemHeaders } from '../../mixer/stem-headers.tsx'
import { StemLanes } from '../../mixer/stem-lanes.tsx'
import { UndetectedStems } from '../../mixer/undetected-stems.tsx'
import { useMixer } from '../../mixer/use-mixer.ts'
import { useMarkers } from '../../markers/use-markers.ts'
import { MarkerRail } from '../../markers/marker-rail.tsx'
import { useLoopEditing } from '../../loops/use-loop-editing.ts'
import { tempoAnalysisAtom } from '../../tempo/tempo-atoms.ts'
import {
  importStateAtom,
  loopEnabledAtom,
  loopRegionAtom,
  transportAtom
} from '../../waveform/player-atoms.ts'
import { useViewport } from '../../waveform/use-viewport.ts'
import { ViewportControls } from '../../waveform/viewport-controls.tsx'
import { WaveformView } from '../../waveform/waveform-view.tsx'
import { ZoomStage } from '../../waveform/zoom-stage.tsx'
import styles from './shell-stage.module.css'

interface ShellStageProps {
  /** Stems the separation masked as near-silent — named in the gutter. */
  readonly undetectedStems: readonly { readonly id: string; readonly label: string }[]
  readonly onDownloadStem: (id: string) => void
  /** Reopen the file picker — the error stage's way out of a failed import. */
  readonly onReimport: () => void
}

/**
 * The zoomable stage: a fixed gutter (zoom controls + per-stem headers)
 * row-aligned with the scrollable lanes (marker rail, waveform, stem lanes).
 * A smart region (ADR 0011): the player state it renders — import lifecycle,
 * playhead, loupe, beat grid — is read here, not threaded by the shell; the
 * A/B drags land on the loops feature's own hook (ADR 0010).
 */
export function ShellStage({
  undetectedStems,
  onDownloadStem,
  onReimport
}: ShellStageProps) {
  const player = usePlayerHandle()
  const loopEditing = useLoopEditing()
  // The region wears the session mix itself (ADR 0010): same atoms, same
  // engine (seated in the session, ADR 0011) as the shell's instance.
  const mixer = useMixer()
  // Same for the session zoom: the shell's shortcuts drive the level the
  // stage's controls show, nothing threaded between them.
  const viewport = useViewport()
  const markers = useMarkers()
  const importState = useAtomValue(importStateAtom)
  const { durationSeconds } = useAtomValue(transportAtom)
  const loopRegion = useAtomValue(loopRegionAtom)
  const loopEnabled = useAtomValue(loopEnabledAtom)
  const beatGrid = useAtomValue(tempoAnalysisAtom)?.grid ?? []
  const isLoaded = importState.status === 'loaded'
  // Fold the present stems back into one envelope — the waveform of the audible
  // mix, each stem weighted by its effective gain so muting/soloing reshapes it.
  // Undefined for an un-separated track (the view then shows its lone waveform).
  const mixWaveform = useMemo(
    () =>
      mixer.channels.length === 0
        ? undefined
        : combineWaveforms(
            mixer.channels.map((channel) => ({
              waveform: channel.stem.track.waveform,
              gain: channel.gain
            }))
          ),
    [mixer.channels]
  )

  return (
    <div className={styles.stage}>
      <div className={styles.gutter}>
        <div className={styles.gutterRuler}>
          <ViewportControls
            zoom={viewport.zoom}
            disabled={!isLoaded}
            onZoomIn={viewport.zoomIn}
            onZoomOut={viewport.zoomOut}
            onSetZoom={viewport.setZoom}
          />
        </div>
        {isLoaded && (
          <>
            <div className={styles.mixLabel}>
              <Trans id="mixer.mix-label">Mix</Trans>
            </div>
            <StemHeaders
              channels={mixer.channels}
              onSetGain={mixer.setGain}
              onSetFilter={mixer.setFilter}
              onToggleMute={mixer.toggleMute}
              onToggleSolo={mixer.toggleSolo}
              onDownloadStem={onDownloadStem}
            />
            <UndetectedStems stems={undetectedStems} />
          </>
        )}
      </div>
      <ZoomStage
        zoom={viewport.zoom}
        position={player.position}
        durationSeconds={durationSeconds}
      >
        <MarkerRail
          markers={markers.markers}
          durationSeconds={durationSeconds}
          onSeek={player.seekToSeconds}
          onMove={markers.move}
          beatGrid={beatGrid}
        />
        <WaveformView
          state={importState}
          loopRegion={loopRegion}
          loopEnabled={loopEnabled}
          beatGrid={beatGrid}
          mixWaveform={mixWaveform}
          durationSeconds={durationSeconds}
          onSeek={player.seekToRatio}
          // The surface speaks fractions of the timeline; the loops feature
          // speaks seconds — this region owns the conversion (it renders the
          // duration anyway).
          onSelectRegion={(startRatio, endRatio, snap) =>
            loopEditing.selectRegion(
              startRatio * durationSeconds,
              endRatio * durationSeconds,
              snap
            )
          }
          onAdjustRegion={(startRatio, endRatio, snap) =>
            loopEditing.adjustRegion(
              startRatio * durationSeconds,
              endRatio * durationSeconds,
              snap
            )
          }
          onReimport={onReimport}
        />
        <StemLanes
          channels={mixer.channels}
          onSeekRatio={player.seekToRatio}
          durationSeconds={durationSeconds}
        />
      </ZoomStage>
    </div>
  )
}
