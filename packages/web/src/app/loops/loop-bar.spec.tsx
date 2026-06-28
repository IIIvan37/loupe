// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { LoopLibrary } from '@app/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { LoopBar } from './loop-bar.tsx'

const library: LoopLibrary = [
  { id: 'a', name: 'Verse', region: { startSeconds: 1, endSeconds: 3 } }
]
const noop = () => {}

describe('LoopBar', () => {
  it('offers save/clear only when a region is selected', () => {
    const { rerender } = render(
      <LoopBar
        hasRegion={false}
        library={[]}
        onSaveRegion={noop}
        onClearRegion={noop}
        onActivate={noop}
        onRemove={noop}
      />
    )
    expect(
      screen.queryByRole('button', { name: 'Enregistrer la boucle' })
    ).not.toBeInTheDocument()

    rerender(
      <LoopBar
        hasRegion
        library={[]}
        onSaveRegion={noop}
        onClearRegion={noop}
        onActivate={noop}
        onRemove={noop}
      />
    )
    expect(
      screen.getByRole('button', { name: 'Enregistrer la boucle' })
    ).toBeInTheDocument()
  })

  it('recalls and removes saved loops', () => {
    const onActivate = vi.fn()
    const onRemove = vi.fn()
    render(
      <LoopBar
        hasRegion={false}
        library={library}
        onSaveRegion={noop}
        onClearRegion={noop}
        onActivate={onActivate}
        onRemove={onRemove}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Verse' }))
    expect(onActivate).toHaveBeenCalledWith(library[0])

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer Verse' }))
    expect(onRemove).toHaveBeenCalledWith('a')
  })
})
