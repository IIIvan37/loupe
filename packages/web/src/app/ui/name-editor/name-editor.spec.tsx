// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { i18n } from '../../../i18n/i18n.ts'
import { I18nTestingProvider } from '../../../i18n/i18n-testing-provider.tsx'
import { NameEditor } from './name-editor.tsx'

function renderEditor(overrides: Partial<Parameters<typeof NameEditor>[0]> = {}) {
  const onSubmit = vi.fn()
  render(
    <NameEditor
      title="Renommer"
      triggerClassName="trigger"
      triggerLabel="Renommer la chose"
      triggerContent="✎"
      submitLabel="Renommer"
      initialName="Avant"
      onSubmit={onSubmit}
      {...overrides}
    />,
    { wrapper: I18nTestingProvider }
  )
  return { onSubmit }
}

describe('NameEditor', () => {
  it('submits the trimmed name', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()
    await user.click(screen.getByRole('button', { name: 'Renommer la chose' }))

    const input = screen.getByLabelText(i18n._('common.name'))
    expect(input).toHaveValue('Avant')
    await user.clear(input)
    await user.type(input, '  Après  ')
    await user.click(screen.getByRole('button', { name: 'Renommer' }))

    expect(onSubmit).toHaveBeenCalledWith('Après')
  })

  it('submits on Enter', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()
    await user.click(screen.getByRole('button', { name: 'Renommer la chose' }))
    const input = screen.getByLabelText(i18n._('common.name'))
    await user.clear(input)
    await user.type(input, 'Après')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('Après')
  })

  it('ignores the Enter that validates an IME candidate', async () => {
    // A CJK keyboard confirms a candidate with Enter: that keystroke belongs to
    // the composition, not to the form. Submitting on it would rename the thing
    // to a half-composed name the user never finished typing.
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()
    await user.click(screen.getByRole('button', { name: 'Renommer la chose' }))
    const input = screen.getByLabelText(i18n._('common.name'))
    await user.clear(input)
    await user.type(input, 'にほんご')

    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(onSubmit).not.toHaveBeenCalled()

    // The Enter that follows the composition is the user's own — it submits.
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('にほんご')
  })

  it('refuses an empty name', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor({ initialName: '' })
    await user.click(screen.getByRole('button', { name: 'Renommer la chose' }))
    const submit = screen.getByRole('button', { name: 'Renommer' })
    expect(submit).toBeDisabled()
    fireEvent.keyDown(screen.getByLabelText(i18n._('common.name')), {
      key: 'Enter'
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
