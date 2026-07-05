import { describe, expect, it } from 'vitest'
import { pickAudioFile } from './pick-audio-file.ts'

/** A minimal File stand-in — only the fields the guard reads. */
function file(name: string, type = ''): File {
  return new File([new Uint8Array([1])], name, { type })
}

describe('pickAudioFile', () => {
  it('returns the first file whose MIME type is audio/*', () => {
    const wav = file('take.wav', 'audio/wav')
    expect(pickAudioFile([wav])).toBe(wav)
  })

  it('falls back to a known audio extension when the OS gives no MIME type', () => {
    // Some platforms drop .flac / .aiff with an empty type.
    const flac = file('mix.flac', '')
    expect(pickAudioFile([flac])).toBe(flac)
  })

  it('matches the extension case-insensitively', () => {
    const mp3 = file('Song.MP3', '')
    expect(pickAudioFile([mp3])).toBe(mp3)
  })

  it('ignores non-audio files', () => {
    expect(pickAudioFile([file('cover.png', 'image/png')])).toBeUndefined()
    expect(pickAudioFile([file('notes.txt', 'text/plain')])).toBeUndefined()
  })

  it('picks the first audio file when several are dropped', () => {
    const png = file('cover.png', 'image/png')
    const first = file('a.wav', 'audio/wav')
    const second = file('b.mp3', 'audio/mpeg')
    expect(pickAudioFile([png, first, second])).toBe(first)
  })

  it('returns undefined for an empty drop', () => {
    expect(pickAudioFile([])).toBeUndefined()
  })
})
