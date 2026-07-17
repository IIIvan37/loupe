import { useState } from 'react'

/**
 * A numeric field committing on Enter/blur and abandoning on Escape: a draft
 * shields the field from the live read-out while the user types. An emptied
 * field commits as NaN, never 0 (`Number('')` is 0 — a floor value out of
 * nowhere); an untouched field commits nothing. Extracted from the tempo
 * panel for the transport bar's fine-tune (T.7).
 */
export function CommitNumberField({
  value,
  min,
  max,
  className,
  label,
  disabled,
  isValid,
  onCommit
}: {
  readonly value: number | undefined
  readonly min: number
  readonly max: number
  readonly className: string | undefined
  readonly label: string
  readonly disabled?: boolean
  /** Whether the consumer would take this number VERBATIM — anything else (a
   * clamp, a floor, a rejection) flags the draft while it is typed (N.4). */
  readonly isValid: (value: number) => boolean
  readonly onCommit: (value: number) => void
}) {
  const [draft, setDraft] = useState<string>()
  // Browsers surface unparseable number-input content as '' + validity
  // .badInput — without this flag that garbage would pass as « transient ».
  const [badInput, setBadInput] = useState(false)
  // An empty draft is a transient mid-edit state, never flagged; content the
  // consumer would mutate or reject is (the old behaviour clamped in silence).
  const draftInvalid =
    badInput ||
    (draft !== undefined && draft.trim() !== '' && !isValid(Number(draft)))
  function commit(): void {
    if (draft === undefined) {
      return
    }
    onCommit(draft.trim() === '' ? Number.NaN : Number(draft))
    abandon()
  }
  function abandon(): void {
    setDraft(undefined)
    setBadInput(false)
  }
  return (
    <input
      type="number"
      className={className}
      inputMode="numeric"
      min={min}
      max={max}
      disabled={disabled}
      value={draft ?? value ?? ''}
      onChange={(event) => {
        setDraft(event.target.value)
        setBadInput(event.target.validity?.badInput ?? false)
      }}
      onBlur={() => commit()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commit()
        }
        if (event.key === 'Escape') {
          abandon()
        }
      }}
      aria-invalid={draftInvalid || undefined}
      aria-label={label}
    />
  )
}
