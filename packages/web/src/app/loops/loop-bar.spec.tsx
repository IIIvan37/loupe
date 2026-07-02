// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { LoopLibrary, LoopRegion } from '@app/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { LoopBar } from './loop-bar.tsx'

const library: LoopLibrary = [
  { id: 'a', name: 'Verse', region: { startSeconds: 1, endSeconds: 3 } }
]
const region: LoopRegion = { startSeconds: 2, endSeconds: 6 }
const noop = () => {}

function renderBar(overrides: Partial<Parameters<typeof LoopBar>[0]> = {}) {
  return render(
    <LoopBar
      region={undefined}
      isSaved={false}
      loopEnabled
      onToggleLoop={noop}
      library={[]}
      onSaveRegion={noop}
      onUpdateLoop={noop}
      onClearRegion={noop}
      onActivate={noop}
      onRemove={noop}
      {...overrides}
    />
  )
}

describe('LoopBar', () => {
  it('offers save/clear only when a region is selected', () => {
    const { rerender } = renderBar()
    expect(
      screen.queryByRole('button', { name: 'Enregistrer la boucle' })
    ).not.toBeInTheDocument()

    rerender(
      <LoopBar
        region={region}
        isSaved={false}
        loopEnabled
        onToggleLoop={noop}
        library={[]}
        onSaveRegion={noop}
        onUpdateLoop={noop}
        onClearRegion={noop}
        onActivate={noop}
        onRemove={noop}
      />
    )
    expect(
      screen.getByRole('button', { name: 'Enregistrer la boucle' })
    ).toBeInTheDocument()
  })

  it('drops save and clear when the active region is an already-saved loop', () => {
    // A saved loop is active → no duplicate save, and no "Effacer": the loop is
    // removed from its chip (✕) instead.
    renderBar({ region: library[0]?.region, isSaved: true, library })

    expect(
      screen.queryByRole('button', { name: 'Enregistrer la boucle' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Effacer' })
    ).not.toBeInTheDocument()
    // Only the loop toggle stays among the active-region controls.
    expect(
      screen.getByRole('button', { name: /Boucle active/ })
    ).toBeInTheDocument()
  })

  it('toggles looping on and off for the active region', async () => {
    const user = userEvent.setup()
    const onToggleLoop = vi.fn()
    const { rerender } = renderBar({ region, loopEnabled: true, onToggleLoop })

    const toggle = screen.getByRole('button', { name: /Boucle active/ })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await user.click(toggle)
    expect(onToggleLoop).toHaveBeenCalledOnce()

    rerender(
      <LoopBar
        region={region}
        isSaved={false}
        loopEnabled={false}
        onToggleLoop={onToggleLoop}
        library={[]}
        onSaveRegion={noop}
        onUpdateLoop={noop}
        onClearRegion={noop}
        onActivate={noop}
        onRemove={noop}
      />
    )
    expect(
      screen.getByRole('button', { name: /Boucle inactive/ })
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('names and saves the active region through the editor', async () => {
    const user = userEvent.setup()
    const onSaveRegion = vi.fn()
    renderBar({ region, onSaveRegion })

    await user.click(
      screen.getByRole('button', { name: 'Enregistrer la boucle' })
    )
    const input = screen.getByLabelText('Nom')
    await user.clear(input)
    await user.type(input, 'Refrain')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(onSaveRegion).toHaveBeenCalledWith('Refrain', region)
  })

  it('renames a saved loop in place (same id and region)', async () => {
    const user = userEvent.setup()
    const onUpdateLoop = vi.fn()
    renderBar({ library, onUpdateLoop })

    await user.click(screen.getByRole('button', { name: 'Renommer Verse' }))
    const input = screen.getByLabelText('Nom')
    await user.clear(input)
    await user.type(input, 'Couplet')
    await user.click(screen.getByRole('button', { name: 'Renommer' }))

    expect(onUpdateLoop).toHaveBeenCalledWith({
      id: 'a',
      name: 'Couplet',
      region: { startSeconds: 1, endSeconds: 3 }
    })
  })

  it('recalls and removes saved loops', async () => {
    const user = userEvent.setup()
    const onActivate = vi.fn()
    const onRemove = vi.fn()
    renderBar({ library, onActivate, onRemove })

    await user.click(screen.getByRole('button', { name: 'Verse' }))
    expect(onActivate).toHaveBeenCalledWith(library[0])

    await user.click(screen.getByRole('button', { name: 'Supprimer Verse' }))
    expect(onRemove).toHaveBeenCalledWith('a')
  })
})
