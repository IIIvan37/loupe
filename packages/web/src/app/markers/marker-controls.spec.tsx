// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { MarkerControls } from './marker-controls.tsx'

describe('MarkerControls', () => {
  it('adds a marker of the chosen kind', () => {
    const onAdd = vi.fn()
    render(<MarkerControls disabled={false} onAdd={onAdd} />)

    fireEvent.click(screen.getByRole('button', { name: '+ Section' }))
    expect(onAdd).toHaveBeenCalledWith('section')

    fireEvent.click(screen.getByRole('button', { name: '+ Temps' }))
    expect(onAdd).toHaveBeenCalledWith('beat')
  })

  it('disables the controls until a track is ready', () => {
    render(<MarkerControls disabled onAdd={() => {}} />)
    expect(screen.getByRole('button', { name: '+ Section' })).toBeDisabled()
  })
})
