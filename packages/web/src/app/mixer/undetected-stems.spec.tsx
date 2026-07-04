// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { UndetectedStems } from './undetected-stems.tsx'

describe('UndetectedStems', () => {
  it('names the masked stems under a heading', () => {
    render(
      <UndetectedStems
        stems={[
          { id: 'guitare', label: 'Guitare' },
          { id: 'claviers', label: 'Claviers' }
        ]}
      />,
      { wrapper: I18nTestingProvider }
    )
    expect(screen.getByText(i18n._('mixer.undetected'))).toBeInTheDocument()
    expect(screen.getByText('Guitare · Claviers')).toBeInTheDocument()
  })

  it('renders nothing when every stem was detected', () => {
    const { container } = render(<UndetectedStems stems={[]} />, {
      wrapper: I18nTestingProvider
    })
    expect(container).toBeEmptyDOMElement()
  })
})
