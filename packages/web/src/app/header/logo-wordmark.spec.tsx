// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { LogoWordmark } from './logo-wordmark.tsx'

describe('LogoWordmark', () => {
  it('exposes the brand as a single image named "Loupe"', () => {
    render(<LogoWordmark />)
    expect(screen.getByRole('img', { name: 'Loupe' })).toBeInTheDocument()
  })

  it('keeps the loop ring decorative — it never competes with the name', () => {
    render(<LogoWordmark />)
    const ring = screen
      .getByRole('img', { name: 'Loupe' })
      .querySelector('svg')
    expect(ring).toHaveAttribute('aria-hidden', 'true')
  })
})
