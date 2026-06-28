// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { MarkerControls } from './marker-controls.tsx'

describe('MarkerControls', () => {
  it('drops a marker at the playhead', () => {
    const onAdd = vi.fn()
    render(<MarkerControls disabled={false} onAdd={onAdd} />)

    fireEvent.click(screen.getByRole('button', { name: '+ Repère' }))
    expect(onAdd).toHaveBeenCalledOnce()
  })

  it('disables the control until a track is ready', () => {
    render(<MarkerControls disabled onAdd={() => {}} />)
    expect(screen.getByRole('button', { name: '+ Repère' })).toBeDisabled()
  })
})
