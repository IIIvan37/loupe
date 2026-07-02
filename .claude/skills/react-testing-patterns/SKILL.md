---
name: react-testing-patterns
description: React component and hook testing idiom for packages/web (Testing Library + Vitest + jsdom). Use when writing or reviewing any *.spec.tsx — component rendering, user interaction, async assertions, renderHook. Complements tdd-cycle (which owns the red-green-refactor discipline); this skill owns HOW the React tests are written.
---

# React testing patterns (packages/web)

Adapted from the community `react-testing-patterns` skill (hieutrtr/ai1-skills,
MIT) to this repo's stack: **Vitest + jsdom + Testing Library**, colocated
`*.spec.tsx` with a `// @vitest-environment jsdom` header, **French accessible
names** in queries, and **hexagonal fakes instead of network mocking** (no MSW —
adapters receive injected fake ports; see `workstation-shell.spec.tsx`).

**Core principle: test behavior, not implementation.** Never assert internal
state, CSS classes, or which hooks were called. One assertion per test
(`tdd-cycle` rule) — a second fact is a second `it`.

## Queries — priority order

Prefer the highest available: `getByRole` (with the French accessible name,
e.g. `{ name: 'Enregistrer le projet' }`) → `getByLabelText` →
`getByText` → `getByDisplayValue`. `getByTestId` is a design smell here:
every control in this app has a role and a French label — if a test needs a
test id, fix the component's semantics instead.

For portals/dialogs (Base UI), query via `screen` (whole document), never via
`container`.

## Interactions — `userEvent` first, `fireEvent` for the exceptions

Default to `@testing-library/user-event`: it dispatches the full real-browser
event sequence (pointerover → … → click) where `fireEvent.click` dispatches a
single synthetic event.

```tsx
const user = userEvent.setup()
render(<WorkstationShell ... />)
await user.click(screen.getByRole('button', { name: 'Projets' }))
await user.type(screen.getByLabelText('Nom'), 'Mon passage')
```

`fireEvent` remains the RIGHT tool for three cases in this codebase:

1. **Range sliders** (`fireEvent.change(slider, { target: { value: '75' } })`)
   — `user-event` cannot drive `<input type="range">`.
2. **Coordinate-based pointer gestures** — the waveform drag-select / loop-edge
   handles (`pointerDown`/`pointerMove`/`pointerUp` with `clientX` against a
   mocked `getBoundingClientRect`). `user.pointer()` adds nothing but noise here.
3. **Keyboard-layout shortcut tests** — `key-bindings` matches physical `code`
   vs typed `key` precisely; `fireEvent.keyDown(document.body, { key, code })`
   keeps that distinction explicit. (`user.keyboard` targets the focused
   element and abstracts the code away.)
4. **Tests running under `vi.useFakeTimers`** — `user.click` hangs on the fake
   clock (verified: neither `setup({ advanceTimers: vi.advanceTimersByTime })`
   nor `setup({ delay: null })` unblocks it, and the leaked clock cascades into
   the next test). Use `fireEvent` inside fake-timer tests, with a comment.

Everything else — clicks, typing in text fields, tabbing — uses `userEvent`.

## Async — `findBy*` > `waitFor` > manual `act`

- Element appears asynchronously → `await screen.findByRole(...)` (it IS
  `getBy` + `waitFor`).
- Waiting on a disappearance or a non-query condition → `waitFor`, with
  **exactly one assertion inside the callback** (multiple assertions in one
  `waitFor` fail intermittently — chain them, or `findBy` first then plain
  `expect`).
- **Never wrap `render`, `fireEvent`, or `userEvent` calls in `act()`** —
  Testing Library already does it internally. Manual `act()` is legitimate in
  exactly two places:
  1. `renderHook` tests that call the hook's API imperatively
     (`act(() => result.current.detach())`) — there is no user event to fire;
  2. advancing fake timers (`act(() => { vi.advanceTimersByTime(300) })`).
- Driving a fake port that pushes state into React from outside
  (`act(() => engine.emit(5))`) is case 1 in disguise — fine.

## Fakes, not mocks

- **Never mock the domain** (`@app/core` values/functions are pure — call them).
- **Never mock the unit under test's internals** — inject a fake at the port
  boundary instead (`PlaybackEngine`, `StemSeparator`, `ProjectDeps`,
  `LoopStore`, a stubbed `fetch` for HTTP adapters). The existing
  `fakeEngine()` / `fakeProjectStores()` helpers in `workstation-shell.spec.tsx`
  are the pattern.
- `renderHook` fakes must be **created once outside the hook callback** —
  `renderHook(() => useProjects(fakeStores()))` rebuilds an empty store on
  every re-render (the `useMemo([stores])` dep changes identity) and produces
  false failures. `const stores = fakeStores()` first.
- `vi.mock()` calls are hoisted: never place them inside `describe`/`it`.

## What NOT to write

- Snapshot tests on dynamic content (timecodes, ids, dates) — assert inline.
- Assertions on internal `useState` values, CSS module class names, or hook
  call counts.
- A `waitFor` whose callback holds more than one `expect`.
- A manual `cleanup()` — Testing Library auto-cleans per test.
