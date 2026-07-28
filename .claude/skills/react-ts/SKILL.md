---
name: react-ts
description: Write correct React + TypeScript. Use when creating or editing .tsx components, typing props/state/hooks/events/context/refs, reviewing or removing unnecessary useEffect calls, or fixing type errors in React code. Covers React 19 (ref as prop, no forwardRef), discriminated unions for state, prop mirroring, when an Effect is the wrong tool, and the strictness settings that catch real bugs.
---

# React + TypeScript

Rules for writing React components that are type-correct and hard to misuse.
Assumes React 19 and `strict: true`. For React 18 differences, see the note at the end.

## The three rules that matter most

1. **Model state so impossible states can't be represented.** A discriminated union
   beats three booleans, every time. This prevents more bugs than everything else here combined.
2. **Let inference work; annotate only where it can't.** Explicit types on things
   TypeScript already knows are noise that drifts out of date.
3. **Types are compile-time only.** Anything crossing a runtime boundary (`fetch`,
   `localStorage`, `postMessage`, URL params) is unvalidated until you validate it.
   A type annotation on an API response is a claim, not a check.

## Props

Define props inline for one-off components, as a named `type`/`interface` when reused.
Required means the component genuinely cannot render without it.

```tsx
type ButtonProps = {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
};

function Button({ children, onClick, variant = 'primary', size = 'md' }: ButtonProps) {
  return <button onClick={onClick} className={`btn btn--${variant} btn--${size}`}>{children}</button>;
}
```

- Defaults go in the destructuring, never `defaultProps` (removed for function components in React 19).
- Use string literal unions, not `string`, for any prop with a known set of values.
- `children: React.ReactNode` — the permissive type, correct for ~99% of children props.
  Use `ReactElement` only when you will `cloneElement` or inspect it.
- Many required props usually means the component does too much. Split it.

**Wrapping a DOM element? Mirror its props — never hand-list them.**

```tsx
type ButtonProps = React.ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary';
};

function Button({ variant = 'primary', className, ...rest }: ButtonProps) {
  return <button className={`btn btn--${variant} ${className ?? ''}`} {...rest} />;
}
```

`ComponentProps<'button'>` gives every native attribute, event handler, ARIA prop, and
(in React 19) `ref`. Use `Omit<..., 'onChange'>` to replace a native prop with your own
signature. Use `ComponentPropsWithoutRef<'button'>` only when you deliberately don't forward a ref.

**Mutually exclusive props → union, not optional flags.**

```tsx
type DialogProps = { children: React.ReactNode } & (
  | { open: boolean; onOpenChange: (open: boolean) => void; defaultOpen?: never }
  | { defaultOpen?: boolean; open?: never; onOpenChange?: never }
);
```

`?: never` explicitly forbids a prop in a variant, so `<Dialog open defaultOpen />` fails
to compile. Narrow with `'open' in props`. Don't reach for this on simple optional props —
`{ showIcon?: boolean; iconName?: string }` is fine as-is.

→ `references/props.md` for children types in depth, polymorphic `as`, generic components, slots.

## State

**Let inference do primitives. Annotate containers, unions, and nullables.**

```tsx
const [count, setCount] = useState(0);              // inferred number — leave it
const [name, setName] = useState('');               // inferred string — leave it

const [todos, setTodos] = useState<Todo[]>([]);     // else never[] — you can't add anything
const [user, setUser] = useState<User | null>(null);// else null — you can never set it
const [filter, setFilter] = useState<Filter>('all');// else string — loses the union
```

`useState([])` inferring `never[]` and `useState(null)` inferring `null` are the two traps
that produce confusing errors later.

**Async/multi-phase state → discriminated union, not parallel booleans.**

```tsx
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };
```

`{ data, loading, error }` allows `loading: true` alongside a rendered error — a state that
should be unreachable. The union makes it unrepresentable, and narrowing on `status` gives
you `data` exactly where it exists.

**Updates that read the previous value must use the functional form.**

```tsx
setTodos((prev) => [...prev, newTodo]);   // ✅ always current
setTodos([...todos, newTodo]);            // ❌ stale inside effects, timers, batched handlers
```

Never mutate: `todos.push(x); setTodos(todos)` keeps the same reference and won't re-render.

**Expensive initial state goes in a function:** `useState(() => parse(localStorage...))` —
otherwise it recomputes every render.

**`useReducer` when transitions are more interesting than the values.** Actions as a
discriminated union, and an exhaustiveness check so a new action type is a compile error:

```tsx
type Action = { type: 'increment' } | { type: 'set'; value: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'increment': return { ...state, count: state.count + 1 };
    case 'set':       return { ...state, count: action.value };  // `value` narrowed in
    default: {
      const _exhaustive: never = action;   // errors if a case is unhandled
      return state;
    }
  }
}
```

→ `references/state.md` for reducer-with-context, action creators, derived Action types, optimistic updates.

## Hooks

- **Custom hooks return an object** (`{ user, isLoading }`) unless the values are genuinely
  positional like `useState`. For tuples, `as const` — otherwise you get `(T | Setter)[]`.
- **Generic hooks over `any`:** `function useFetch<T>(url: string): AsyncState<T>`.
- **`useCallback`/`useMemo` are for referential stability, not speed.** Reach for them when
  a value is a dependency of another hook or a prop to a memoized child. Wrapping every
  handler is cargo cult, and the React Compiler makes most of it unnecessary.
- Never call hooks conditionally or in loops.

**Refs:** always parameterize; DOM refs start `null`.

```tsx
const inputRef = useRef<HTMLInputElement>(null);
useEffect(() => { inputRef.current?.focus(); }, []);   // null during first render

const timerRef = useRef<number | undefined>(undefined); // React 19 requires an initial arg
```

Reading `ref.current` during render is wrong — refs are set in the commit phase. Use an
effect, or a callback ref when you need to act the moment the element appears (and for
dynamic lists, where one ref object won't do).

**React 19: `ref` is an ordinary prop. Don't use `forwardRef`.**

```tsx
type InputProps = React.ComponentProps<'input'> & { label: string };

function Input({ label, ref, ...rest }: InputProps) {
  return <label>{label}<input ref={ref} {...rest} /></label>;
}
```

Use `useImperativeHandle` only to expose a curated API (`{ play, pause }`) instead of the
raw element — and prefer props over an imperative handle when a prop can express it.

→ `references/hooks.md` for custom hook patterns, imperative handles, callback ref factories, memoization.

## Effects

**Most `useEffect` calls in React code shouldn't exist.** An Effect synchronizes with a system
*outside* React. If nothing outside React is involved, it's the wrong tool — it costs an extra
render, a stale-closure risk, and a dependency array to keep correct.

The test: code that runs because the component was **displayed** belongs in an Effect.
Everything else belongs in an event handler or in render.

Before writing one, check the four common escapes:

```tsx
// 1. Deriving a value → compute during render, no state, no Effect
const visible = todos.filter((t) => !t.done);

// 2. Reacting to a user action → the handler, where the cause is
function handleSubmit() { post('/api/orders', order); }

// 3. Resetting state when a prop changes → key, and React resets it for you
<Profile userId={userId} key={userId} />

// 4. Telling the parent about a change → call it in the same handler, one render
function handleClick() { const next = !isOn; setIsOn(next); onChange(next); }
```

A boolean state variable whose only job is to trigger an Effect is always case 2. Two Effects
that trigger each other are a chain to collapse into one handler.

**What Effects are legitimately for:** synchronizing with a non-React system (canvas, media,
map, third-party widget), subscribing to an external store (prefer `useSyncExternalStore`),
analytics on display, and data fetching — the last with cleanup against race conditions, and
better delegated to a query library or framework loader when there is one.

**Effects that stay need cleanup.** Timers, subscriptions, listeners, aborts — return the
teardown. And treat an empty dependency array as a smell worth a second look: it usually
means "on mount", which is lifecycle thinking rather than synchronization.

→ `references/effects.md` for all ten don't-need-an-Effect cases and a review checklist.

## Events

Type the handler by **element**, not by feeling. `ChangeEvent<HTMLInputElement>` covers most of it.

```tsx
const onChange = (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value);
const onSubmit = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); /* … */ };
const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Escape') e.currentTarget.blur(); };
```

| Type | For |
|---|---|
| `ChangeEvent<T>` | input / select / textarea changes |
| `FormEvent<HTMLFormElement>` | submit |
| `MouseEvent<T>` | click, hover |
| `KeyboardEvent<T>` | keys — `onKeyDown`, not the deprecated `onKeyPress` |
| `FocusEvent<T>` | focus / blur |

- **Handlers passed inline are inferred** — don't annotate `onClick={(e) => …}`, the JSX
  attribute already types `e`. Annotate only handlers declared separately.
- **`currentTarget`, not `target`.** `currentTarget` is the element the handler is on and is
  properly typed; `target` is whatever was actually hit (possibly a child) and is `EventTarget`.
- **`<input type="number">` returns a string.** Always convert explicitly, and handle `''`
  and `NaN` — `const n = value === '' ? 0 : Number(value); if (!Number.isNaN(n)) setAge(n);`
- Callback props should pass domain values, not events: `onChange: (value: string) => void`
  beats leaking `ChangeEvent` into the parent.

→ `references/events-forms.md` for controlled vs uncontrolled, form submission, validation, IME/drag events.

## Context

Never use a fake default. Type it nullable and throw in the hook — the hook's return type
is then non-nullable and callers need no checks.

```tsx
const ThemeContext = createContext<ThemeValue | null>(null);

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
```

Export the hook, not the context — that way the guard can't be bypassed.

**Memoize the provider value**, or every consumer re-renders on each provider render:

```tsx
const value = useMemo(() => ({ theme, setTheme }), [theme]);
```

When state and actions have different update frequencies, split them into two contexts:
components that only dispatch then never re-render on state changes.

→ `references/hooks.md` (Context section) for the `createSafeContext` factory and state/actions split.

## TypeScript mechanics worth knowing

- **`as const satisfies T`** for config objects and lookup tables: validates the shape while
  keeping literal types. Plain `: T` annotation widens and loses them.
- **`as const` on arrays** to derive unions: `const sizes = ['sm','md'] as const;`
  `type Size = (typeof sizes)[number]`.
- **Never use `as` to silence an error.** An assertion tells the compiler to stop checking —
  it doesn't make anything true. Narrow with a type guard, or `unknown` + validation.
- **`unknown`, never `any`,** for external data. `any` disables checking silently and spreads.
- **`Pick` / `Omit` / `Partial`** to derive prop types from domain types instead of restating them.
- **`// @ts-expect-error` over `@ts-ignore`** — it fails the build once the underlying issue is
  fixed, so it can't rot. Always with a comment saying why.

→ `references/type-system.md` for narrowing, generics, mapped/conditional types, utility types, strictness config.

## Anti-patterns

| Don't | Do |
|---|---|
| `data: any` | `data: unknown` + validate, or a real type |
| `isLoading` + `isError` + `isSuccess` | one `status` discriminated union |
| `useEffect` to derive state from props/state | compute during render |
| `useEffect` reacting to a boolean "trigger" flag | put the code in the event handler |
| `useEffect` to reset state on a prop change | `key` on the component |
| `useState<string>('')` | `useState('')` |
| `useState([])` | `useState<Todo[]>([])` |
| `as SomeType` to fix an error | type guard, or fix the type |
| hand-listing native DOM props | `ComponentProps<'button'>` |
| `forwardRef` (React 19) | `ref` as a regular prop |
| every prop optional | required what's required |
| `e.target.value` in a typed handler | `e.currentTarget.value` |
| context default `{}` cast to the type | `null` default + throwing hook |

## Assumed config

```jsonc
{
  "strict": true,                    // non-negotiable; strictNullChecks catches the most React bugs
  "noUncheckedIndexedAccess": true,  // arr[i] is T | undefined — it always was
  "jsx": "react-jsx",                // no React import needed
  "verbatimModuleSyntax": true       // forces `import type`, avoids runtime import surprises
}
```

On an existing codebase, adopt in order: `noImplicitAny` → `strictNullChecks` → the rest.

## React 18 differences

If the project is on React 18, three things change:

- `ref` is **not** a prop — wrap in `forwardRef<HTMLInputElement, Props>` and set `displayName`.
- Use `ComponentPropsWithoutRef<'button'>` for wrappers (`ComponentProps` includes a `ref` you can't accept).
- `useRef<number>()` with no argument is legal; React 19 types require an explicit initial value.

Check `package.json` before assuming. The rest of this skill applies unchanged.
