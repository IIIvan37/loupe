// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { ImportMenu } from './import-menu.tsx'

function renderMenu(
  overrides: Partial<Parameters<typeof ImportMenu>[0]> = {}
) {
  const onImportUrl = vi.fn()
  const onImportFile = vi.fn()
  render(
    <ImportMenu
      onImportFile={onImportFile}
      onImportUrl={onImportUrl}
      urlBusy={false}
      needsConfirm={false}
      {...overrides}
    />,
    { wrapper: I18nTestingProvider }
  )
  return { onImportUrl, onImportFile }
}

/**
 * Open the « Depuis une URL… » popover, paste `url` into its field (atomic, as a
 * real link paste — no per-keystroke intermediate host), and return the controls.
 */
async function openUrlWith(
  user: ReturnType<typeof userEvent.setup>,
  url: string
) {
  await user.click(screen.getByRole('button', { name: i18n._('header.import') }))
  await user.click(screen.getByText(i18n._('header.import-from-url')))
  const field = screen.getByLabelText(i18n._('import.url-field'))
  await user.click(field)
  await user.paste(url)
  const submit = screen.getByRole('button', {
    name: i18n._('import.url-submit')
  })
  return { field, submit }
}

describe('ImportMenu — unsupported URL guard', () => {
  it('warns and blocks submit for an unsupported host', async () => {
    const user = userEvent.setup()
    const { onImportUrl } = renderMenu()
    const { submit } = await openUrlWith(user, 'https://open.spotify.com/track/xyz')

    expect(
      screen.getByText(i18n._('import.url-unsupported'))
    ).toBeInTheDocument()
    expect(submit).toBeDisabled()

    await user.click(submit)
    expect(onImportUrl).not.toHaveBeenCalled()
  })

  it('accepts a supported host: no warning, submit enabled', async () => {
    const user = userEvent.setup()
    const { onImportUrl } = renderMenu()
    const { submit } = await openUrlWith(user, 'https://youtu.be/dQw4w9WgXcQ')

    expect(
      screen.queryByText(i18n._('import.url-unsupported'))
    ).not.toBeInTheDocument()
    expect(submit).toBeEnabled()

    await user.click(submit)
    expect(onImportUrl).toHaveBeenCalledWith('https://youtu.be/dQw4w9WgXcQ')
  })
})
