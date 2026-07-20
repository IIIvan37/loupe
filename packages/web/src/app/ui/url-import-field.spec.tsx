// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { i18n } from '../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { UrlImportField } from './url-import-field.tsx'

/** A thin controlled host so the field behaves as it does in a real consumer. */
function Host({
  onSubmit,
  busy = false
}: {
  onSubmit: (url: string) => void
  busy?: boolean
}) {
  const [value, setValue] = useState('')
  return (
    <UrlImportField
      value={value}
      onValueChange={setValue}
      onSubmit={onSubmit}
      busy={busy}
    />
  )
}

function renderField(overrides: { busy?: boolean } = {}) {
  const onSubmit = vi.fn()
  const user = userEvent.setup()
  render(<Host onSubmit={onSubmit} busy={overrides.busy ?? false} />, {
    wrapper: I18nTestingProvider
  })
  const field = screen.getByLabelText(i18n._('import.url-field'))
  const submit = screen.getByRole('button', { name: i18n._('import.url-submit') })
  return { onSubmit, user, field, submit }
}

describe('UrlImportField', () => {
  it('warns and blocks submit for an unsupported host', async () => {
    const { onSubmit, user, field, submit } = renderField()
    await user.click(field)
    await user.paste('https://open.spotify.com/track/xyz')

    expect(
      screen.getByText(i18n._('import.url-unsupported'))
    ).toBeInTheDocument()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(submit).toBeDisabled()

    await user.click(submit)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the trimmed URL for a supported host', async () => {
    const { onSubmit, user, field, submit } = renderField()
    await user.click(field)
    await user.paste('  https://youtu.be/dQw4w9WgXcQ  ')

    expect(
      screen.queryByText(i18n._('import.url-unsupported'))
    ).not.toBeInTheDocument()
    expect(submit).toBeEnabled()

    await user.click(submit)
    expect(onSubmit).toHaveBeenCalledWith('https://youtu.be/dQw4w9WgXcQ')
  })

  it('locks the field and submit while a download runs', async () => {
    const { field, submit } = renderField({ busy: true })
    expect(field).toBeDisabled()
    expect(submit).toBeDisabled()
  })
})
