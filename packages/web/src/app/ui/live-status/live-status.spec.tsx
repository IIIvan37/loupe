// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { LiveStatus } from './live-status.tsx'

describe('LiveStatus', () => {
  it('exposes an empty status region when there is nothing to announce', () => {
    render(<LiveStatus message={undefined} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('announces the message it is given', () => {
    render(<LiveStatus message="Analyse…" />)
    expect(screen.getByRole('status')).toHaveTextContent('Analyse…')
  })

  it('announces each new message', () => {
    const { rerender } = render(<LiveStatus message="Analyse…" />)
    rerender(<LiveStatus message="120 BPM" />)
    expect(screen.getByRole('status')).toHaveTextContent('120 BPM')
  })

  it('falls silent when the message is withdrawn', () => {
    const { rerender } = render(<LiveStatus message="120 BPM" />)
    rerender(<LiveStatus message={undefined} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})
