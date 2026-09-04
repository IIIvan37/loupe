import type { DecodedAudio, TrackMetadata } from '@app/core'
import { atom } from 'jotai'

/**
 * The loaded track's session state — the values the analyses, the export and
 * the separation consume, each reading them itself (ADR 0010) instead of the
 * shell threading them down as props. A LEAF module of the web DAG (ADR
 * 0012): tempo, lead-sheet, markers and waveform all read it, and it depends
 * on nothing, so it can never close a cycle — the reason it lives here and
 * not in `waveform/player-atoms.ts` (waveform → loops → tempo). Nothing
 * decides anything in this file: only `usePlayer` writes it.
 */

/** The decoded PCM of the loaded track. Undefined until an import lands, and
 * again the moment a new one starts: the consumers key on its identity (a
 * replaced track aborts their runs). */
export const loadedAudioAtom = atom<DecodedAudio | undefined>(undefined)

/** No tags at all — the atom's rest value and the import's fallback. */
export const NO_TRACK_METADATA: TrackMetadata = {
  title: undefined,
  artist: undefined
}

/** Tags of the loaded track (empty fields when the file has none). Seeded
 * with the import's fallback the moment it starts, then overridden by the
 * fields the file actually carries — the header and a save read it. */
export const trackMetadataAtom = atom<TrackMetadata>(NO_TRACK_METADATA)

/** The imported file's original encoded bytes — what a saved project stores
 * as the source. Undefined until an import lands, and again when a new one
 * starts. */
export const loadedBytesAtom = atom<ArrayBuffer | undefined>(undefined)
