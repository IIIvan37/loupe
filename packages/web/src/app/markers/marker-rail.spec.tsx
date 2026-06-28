// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { MarkerList } from '@app/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { MarkerRail } from './marker-rail.tsx'

const markers: MarkerList = [
  { id: 'a', timeSeconds: 5, kind: 'section', label: 'Section 1' }
]

const noop = () => {}

describe('MarkerRail', () => {
  it('seeks to a section marker when its tag is clicked', () => {
    const onSeek = vi.fn()
    render(
      <MarkerRail markers={markers} durationSeconds={10} onSeek={onSeek} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Aller à Section 1' }))
    expect(onSeek).toHaveBeenCalledWith(5)
  })

  it('renders nothing until a duration is known', () => {
    render(
      <MarkerRail markers={markers} durationSeconds={0} onSeek={noop} />
    )
    expect(
      screen.queryByRole('button', { name: 'Aller à Section 1' })
    ).not.toBeInTheDocument()
  })
})
