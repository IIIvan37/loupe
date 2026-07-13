// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { I18nTestingProvider } from '../../i18n/i18n-testing-provider.tsx'
import { i18n } from '../../i18n/i18n.ts'
import {
  MarkerControls,
  type StructureDetectionControl
} from './marker-controls.tsx'

/** A ready detection surface — the button enabled, no markers yet, idle. */
function detectionControl(
  overrides: Partial<StructureDetectionControl> = {}
): StructureDetectionControl {
  return {
    blockedReason: undefined,
    detecting: false,
    error: undefined,
    succeeded: false,
    hasMarkers: false,
    hasGrid: false,
    onDetect: vi.fn(),
    ...overrides
  }
}

describe('MarkerControls', () => {
  it('drops a marker at the playhead', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<MarkerControls disabled={false} onAdd={onAdd} />, {
      wrapper: I18nTestingProvider
    })

    await user.click(screen.getByRole('button', { name: i18n._('markers.add') }))
    expect(onAdd).toHaveBeenCalledOnce()
  })

  it('disables the control until a track is ready', () => {
    render(<MarkerControls disabled onAdd={() => {}} />, {
      wrapper: I18nTestingProvider
    })
    expect(
      screen.getByRole('button', { name: i18n._('markers.add') })
    ).toBeDisabled()
  })

  it('shows no detect button until the detection surface is wired', () => {
    render(<MarkerControls disabled={false} onAdd={() => {}} />, {
      wrapper: I18nTestingProvider
    })
    expect(
      screen.queryByRole('button', { name: i18n._('structure.detect') })
    ).not.toBeInTheDocument()
  })

  it('detects the structure straight away when no markers exist', async () => {
    const user = userEvent.setup()
    const onDetect = vi.fn()
    render(
      <MarkerControls
        disabled={false}
        onAdd={() => {}}
        detection={detectionControl({ onDetect })}
      />,
      { wrapper: I18nTestingProvider }
    )

    await user.click(
      screen.getByRole('button', { name: i18n._('structure.detect') })
    )
    expect(onDetect).toHaveBeenCalledOnce()
  })

  it('confirms before replacing existing markers', async () => {
    const user = userEvent.setup()
    const onDetect = vi.fn()
    render(
      <MarkerControls
        disabled={false}
        onAdd={() => {}}
        detection={detectionControl({ hasMarkers: true, onDetect })}
      />,
      { wrapper: I18nTestingProvider }
    )

    // First click only arms the « Remplacer les repères ? » confirm.
    await user.click(
      screen.getByRole('button', { name: i18n._('structure.detect') })
    )
    expect(onDetect).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole('button', { name: i18n._('structure.detect-confirm') })
    )
    expect(onDetect).toHaveBeenCalledOnce()
  })

  it('confirms before relabelling an existing grid, naming the grid', async () => {
    const user = userEvent.setup()
    const onDetect = vi.fn()
    render(
      <MarkerControls
        disabled={false}
        onAdd={() => {}}
        detection={detectionControl({ hasGrid: true, onDetect })}
      />,
      { wrapper: I18nTestingProvider }
    )

    await user.click(
      screen.getByRole('button', { name: i18n._('structure.detect') })
    )
    expect(onDetect).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', {
        name: i18n._('structure.detect-confirm-grid')
      })
    )
    expect(onDetect).toHaveBeenCalledOnce()
  })

  it('names both when markers and a grid are both at stake', async () => {
    const user = userEvent.setup()
    render(
      <MarkerControls
        disabled={false}
        onAdd={() => {}}
        detection={detectionControl({ hasMarkers: true, hasGrid: true })}
      />,
      { wrapper: I18nTestingProvider }
    )

    await user.click(
      screen.getByRole('button', { name: i18n._('structure.detect') })
    )
    expect(
      screen.getByRole('button', {
        name: i18n._('structure.detect-confirm-both')
      })
    ).toBeInTheDocument()
  })

  it('blocks detection while the server is unreachable, explaining why', () => {
    render(
      <MarkerControls
        disabled={false}
        onAdd={() => {}}
        detection={detectionControl({ blockedReason: 'server' })}
      />,
      { wrapper: I18nTestingProvider }
    )
    expect(
      screen.getByRole('button', { name: i18n._('structure.detect') })
    ).toBeDisabled()
    expect(
      screen.getByText(i18n._('structure.detect-needs-server'))
    ).toBeInTheDocument()
  })

  it('shows the busy label while a detection is in flight', () => {
    render(
      <MarkerControls
        disabled={false}
        onAdd={() => {}}
        detection={detectionControl({ detecting: true })}
      />,
      { wrapper: I18nTestingProvider }
    )
    expect(
      screen.getByRole('button', { name: i18n._('structure.detecting-short') })
    ).toBeDisabled()
  })

  it('surfaces a failed detection as an actionable line', () => {
    render(
      <MarkerControls
        disabled={false}
        onAdd={() => {}}
        detection={detectionControl({ error: 'no-structure' })}
      />,
      { wrapper: I18nTestingProvider }
    )
    // Shown in the visible line AND spoken through the live region — both
    // carry the same actionable text.
    expect(
      screen.getAllByText(
        `${i18n._('structure.detect-failed')} — ${i18n._('structure.error.no-structure')}`
      ).length
    ).toBeGreaterThan(0)
  })
})
