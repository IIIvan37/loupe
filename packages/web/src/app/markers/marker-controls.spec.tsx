// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { MarkerControls } from './marker-controls.tsx'

describe('MarkerControls', () => {
  it('drops a marker at the playhead', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<MarkerControls disabled={false} onAdd={onAdd} />)

    await user.click(screen.getByRole('button', { name: '+ Repère' }))
    expect(onAdd).toHaveBeenCalledOnce()
  })

  it('disables the control until a track is ready', () => {
    render(<MarkerControls disabled onAdd={() => {}} />)
    expect(screen.getByRole('button', { name: '+ Repère' })).toBeDisabled()
  })
})
