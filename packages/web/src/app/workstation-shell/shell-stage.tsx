import { Trans } from '@lingui/react/macro'
import { type BeatGrid, combineWaveforms } from '@app/core'
import { type ComponentProps, useMemo } from 'react'
import { StemHeaders } from '../mixer/stem-headers.tsx'
import { StemLanes } from '../mixer/stem-lanes.tsx'
import type { useMixer } from '../mixer/use-mixer.ts'
import type { useMarkers } from '../markers/use-markers.ts'
import { MarkerRail } from '../markers/marker-rail.tsx'
import type { useLoopEditing } from '../loops/use-loop-editing.ts'
import type { useViewport } from '../waveform/use-viewport.ts'
import { ViewportControls } from '../waveform/viewport-controls.tsx'
import { WaveformView } from '../waveform/waveform-view.tsx'
import { ZoomStage } from '../waveform/zoom-stage.tsx'
import styles from './workstation-shell.module.css'

interface ShellStageProps {
  readonly isLoaded: boolean
  readonly positionRatio: number
  readonly durationSeconds: number
  readonly viewport: ReturnType<typeof useViewport>
  readonly mixer: ReturnType<typeof useMixer>
  readonly onDownloadStem: (id: string) => void
  readonly markers: ReturnType<typeof useMarkers>
  readonly loopEditing: ReturnType<typeof useLoopEditing>
  readonly beatGrid: BeatGrid
  readonly mainViewState: ComponentProps<typeof WaveformView>['state']
  readonly loopRegion: ComponentProps<typeof WaveformView>['loopRegion']
  readonly loopEnabled: boolean
  readonly onSeekSeconds: (seconds: number) => void
  readonly onSeekRatio: (ratio: number) => void
}

/**
 * The zoomable stage: a fixed gutter (zoom controls + per-stem headers)
 * row-aligned with the scrollable lanes (marker rail, waveform, stem lanes).
 */
export function ShellStage({
  isLoaded,
  positionRatio,
  durationSeconds,
  viewport,
  mixer,
  onDownloadStem,
  markers,
  loopEditing,
  beatGrid,
  mainViewState,
  loopRegion,
  loopEnabled,
  onSeekSeconds,
  onSeekRatio
}: ShellStageProps) {
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
              onToggleMute={mixer.toggleMute}
              onToggleSolo={mixer.toggleSolo}
              onDownloadStem={onDownloadStem}
            />
          </>
        )}
      </div>
      <ZoomStage zoom={viewport.zoom} positionRatio={positionRatio}>
        <MarkerRail
          markers={markers.markers}
          durationSeconds={durationSeconds}
          onSeek={onSeekSeconds}
          onMove={markers.move}
        />
        <WaveformView
          state={mainViewState}
          loopRegion={loopRegion}
          loopEnabled={loopEnabled}
          beatGrid={beatGrid}
          mixWaveform={mixWaveform}
          durationSeconds={durationSeconds}
          onSeek={onSeekRatio}
          onSelectRegion={loopEditing.selectRegion}
          onAdjustRegion={loopEditing.adjustRegion}
        />
        <StemLanes channels={mixer.channels} />
      </ZoomStage>
    </div>
  )
}
