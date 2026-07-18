/**
 * The session's stem channel ids for the sources analysis cares about —
 * the server manifest speaks FRENCH ids (server/app/stem_manifest.py:
 * drums→batterie, bass→basse), and every separated stem in the session
 * carries them (mixer channels, colours, WAV filenames). Analysis lookups
 * must match these, not Demucs' English source names.
 */
export const DRUMS_STEM_ID = 'batterie'
export const BASS_STEM_ID = 'basse'
