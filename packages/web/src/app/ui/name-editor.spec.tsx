// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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
  it('submits the trimmed name', () => {
    const { onSubmit } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Renommer la chose' }))

    const input = screen.getByLabelText('Nom')
    expect(input).toHaveValue('Avant')
    fireEvent.change(input, { target: { value: '  Après  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Renommer' }))

    expect(onSubmit).toHaveBeenCalledWith('Après')
  })

  it('submits on Enter', () => {
    const { onSubmit } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Renommer la chose' }))
    const input = screen.getByLabelText('Nom')
    fireEvent.change(input, { target: { value: 'Après' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('Après')
  })

  it('refuses an empty name', () => {
    const { onSubmit } = renderEditor({ initialName: '' })
    fireEvent.click(screen.getByRole('button', { name: 'Renommer la chose' }))
    const submit = screen.getByRole('button', { name: 'Renommer' })
    expect(submit).toBeDisabled()
    fireEvent.keyDown(screen.getByLabelText('Nom'), { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
