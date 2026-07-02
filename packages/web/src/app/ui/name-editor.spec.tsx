// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
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
    />
  )
  return { onSubmit }
}

describe('NameEditor', () => {
  it('submits the trimmed name', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()
    await user.click(screen.getByRole('button', { name: 'Renommer la chose' }))

    const input = screen.getByLabelText('Nom')
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
    const input = screen.getByLabelText('Nom')
    await user.clear(input)
    await user.type(input, 'Après')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('Après')
  })

  it('refuses an empty name', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor({ initialName: '' })
    await user.click(screen.getByRole('button', { name: 'Renommer la chose' }))
    const submit = screen.getByRole('button', { name: 'Renommer' })
    expect(submit).toBeDisabled()
    fireEvent.keyDown(screen.getByLabelText('Nom'), { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
