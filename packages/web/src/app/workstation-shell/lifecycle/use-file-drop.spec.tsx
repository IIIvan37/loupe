// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useFileDrop } from './use-file-drop.ts'

function audioFile(): File {
  return new File([new Uint8Array([1])], 'take.wav', { type: 'audio/wav' })
}

const noRejection = () => {}

/** A thin harness: the hook drives a full-surface drop region. */
function Harness({
  onFile,
  onRejected = noRejection
}: {
  readonly onFile: (file: File) => void
  readonly onRejected?: () => void
}) {
  const { isDraggingFile, dropHandlers } = useFileDrop(onFile, onRejected)
  return (
    <div data-testid="zone" {...dropHandlers}>
      {isDraggingFile ? 'dragging' : 'idle'}
      <span data-testid="child">child</span>
    </div>
  )
}

/** A drag/drop event init carrying files, as a real file drag would. */
function fileTransfer(files: File[] = []) {
  return { dataTransfer: { files, types: ['Files'] } }
}

describe('useFileDrop', () => {
  it('flags a file drag on dragenter and clears it on the matching dragleave', () => {
    render(<Harness onFile={vi.fn()} />)
    const zone = screen.getByTestId('zone')

    expect(zone).toHaveTextContent('idle')
    fireEvent.dragEnter(zone, fileTransfer())
    expect(zone).toHaveTextContent('dragging')
    fireEvent.dragLeave(zone, fileTransfer())
    expect(zone).toHaveTextContent('idle')
  })

  it('stays flagged while the drag crosses into a child (depth counter)', () => {
    render(<Harness onFile={vi.fn()} />)
    const zone = screen.getByTestId('zone')
    const child = screen.getByTestId('child')

    fireEvent.dragEnter(zone, fileTransfer())
    fireEvent.dragEnter(child, fileTransfer())
    fireEvent.dragLeave(zone, fileTransfer())
    // One enter still outstanding — the overlay must not flicker off.
    expect(zone).toHaveTextContent('dragging')
    fireEvent.dragLeave(child, fileTransfer())
    expect(zone).toHaveTextContent('idle')
  })

  it('ignores a drag that carries no files (e.g. a text selection)', () => {
    render(<Harness onFile={vi.fn()} />)
    const zone = screen.getByTestId('zone')
    const text = { dataTransfer: { files: [], types: ['text/plain'] } }

    fireEvent.dragEnter(zone, text)
    expect(zone).toHaveTextContent('idle')
    // A stray dragleave from a non-file drag must be ignored (no underflow).
    fireEvent.dragLeave(zone, text)
    expect(zone).toHaveTextContent('idle')
  })

  it('solicits the drop by preventing default on a file dragover only', () => {
    render(<Harness onFile={vi.fn()} />)
    const zone = screen.getByTestId('zone')

    // fireEvent returns false when a handler called preventDefault.
    expect(fireEvent.dragOver(zone, fileTransfer([audioFile()]))).toBe(false)
    // A non-file dragover is left alone (the drop is not solicited).
    expect(
      fireEvent.dragOver(zone, { dataTransfer: { files: [], types: ['text/plain'] } })
    ).toBe(true)
  })

  it('hands a dropped audio file to the callback and clears the flag', () => {
    const onFile = vi.fn()
    render(<Harness onFile={onFile} />)
    const zone = screen.getByTestId('zone')
    const file = audioFile()

    fireEvent.dragEnter(zone, fileTransfer([file]))
    fireEvent.drop(zone, fileTransfer([file]))

    expect(onFile).toHaveBeenCalledWith(file)
    expect(zone).toHaveTextContent('idle')
  })

  it('drops a non-audio file without importing — flag cleared', () => {
    const onFile = vi.fn()
    render(<Harness onFile={onFile} />)
    const zone = screen.getByTestId('zone')
    const png = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })

    fireEvent.dragEnter(zone, fileTransfer([png]))
    fireEvent.drop(zone, fileTransfer([png]))

    expect(onFile).not.toHaveBeenCalled()
    expect(zone).toHaveTextContent('idle')
  })

  it('signals the rejection when the dropped files hold no audio', () => {
    const onRejected = vi.fn()
    render(<Harness onFile={vi.fn()} onRejected={onRejected} />)
    const zone = screen.getByTestId('zone')
    const png = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' })

    fireEvent.drop(zone, fileTransfer([png]))

    expect(onRejected).toHaveBeenCalled()
  })

  it('signals no rejection for an accepted audio drop', () => {
    const onRejected = vi.fn()
    render(<Harness onFile={vi.fn()} onRejected={onRejected} />)
    const zone = screen.getByTestId('zone')

    fireEvent.drop(zone, fileTransfer([audioFile()]))

    expect(onRejected).not.toHaveBeenCalled()
  })

  it('signals no rejection for a drop that carries no files (e.g. text)', () => {
    const onRejected = vi.fn()
    render(<Harness onFile={vi.fn()} onRejected={onRejected} />)
    const zone = screen.getByTestId('zone')

    fireEvent.drop(zone, { dataTransfer: { files: [], types: ['text/plain'] } })

    expect(onRejected).not.toHaveBeenCalled()
  })
})
