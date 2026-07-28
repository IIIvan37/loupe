# State: useState, useReducer, async data

## When to annotate `useState`

Inference is right for anything with a meaningful initial value. Annotate in four cases:

```tsx
// 1. Empty containers — otherwise never[] / {}
const [todos, setTodos] = useState<Todo[]>([]);
const [filters, setFilters] = useState<Partial<Filters>>({});

// 2. Nullable / not-yet-loaded — otherwise the type is literally `null`
const [user, setUser] = useState<User | null>(null);

// 3. Unions — otherwise widened to string
type Filter = 'all' | 'active' | 'completed';
const [filter, setFilter] = useState<Filter>('all');

// 4. When the initial value is narrower than what you'll set later
const [size, setSize] = useState<'sm' | 'md' | 'lg'>('md');
```

Everything else: `useState(0)`, `useState('')`, `useState(false)`.
`useState<string>('')` is redundant — the annotation adds nothing and can drift.

`useState('idle' as const)` constrains only the initial value, not subsequent `setStatus`
calls. Annotate the generic instead.

## Discriminated unions for state

The single highest-value pattern in this skill.

```tsx
// ❌ 16 representable combinations, ~4 of which are valid
type BadState<T> = { data: T | null; isLoading: boolean; error: string | null };

// ✅ 4 states, all valid
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };
```

The payoff is at the render site — `data` only exists where it's real, so there's nothing
to null-check and no way to show a spinner over an error:

```tsx
function UserView({ state }: { state: AsyncState<User> }) {
  switch (state.status) {
    case 'idle':    return null;
    case 'loading': return <Spinner />;
    case 'error':   return <ErrorMessage error={state.error} />;
    case 'success': return <Profile user={state.data} />;   // data guaranteed
  }
}
```

Apply the same shape to anything with phases: form submission, wizards, connection status,
optimistic mutations, feature flags with variants.

### Exhaustiveness

Assign to `never` to turn "forgot a case" into a compile error:

```tsx
default: {
  const _exhaustive: never = state;
  throw new Error(`Unhandled status: ${JSON.stringify(_exhaustive)}`);
}
```

With `switch` on a union in a function with a declared return type, TypeScript already errors
on a missing case via the return path. The `never` assignment is the explicit belt-and-braces
version — use it in reducers, where there's no return-type pressure.

## Updating state

**Functional updates whenever the next value depends on the previous one.** Not a style
preference — the direct form captures a stale value inside effects, timers, and async callbacks.

```tsx
setCount((prev) => prev + 1);
setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
setTodos((prev) => prev.filter((t) => t.id !== id));
```

```tsx
useEffect(() => {
  const id = setInterval(() => setCount((c) => c + 1), 1000);  // ✅
  // setInterval(() => setCount(count + 1), 1000)              // ❌ always initial + 1
  return () => clearInterval(id);
}, []);
```

**Never mutate.** `todos.push(x); setTodos(todos)` passes the same reference; React bails out
of the render. Same for `sort()` and `reverse()` — copy first: `[...todos].sort(…)`.

**Lazy initialization** for anything expensive:

```tsx
const [todos, setTodos] = useState<Todo[]>(() => {
  const saved = localStorage.getItem('todos');
  return saved ? JSON.parse(saved) : [];      // parsed once, not on every render
});
```

Note that `JSON.parse` returns `any` — the annotation is a claim. Validate if the data matters.

## Splitting vs combining state

- **Together** when values change as a unit and are read together: form fields, a viewport size.
- **Apart** when they change independently: a list, its filter, and a search term are three
  concerns with three lifetimes.

Deeply nested state objects make every update a chain of spreads. That's the signal to either
flatten, split, or move to `useReducer`.

## useReducer

Reach for it when transitions are more interesting than the values: several actions touching
the same fields, transitions with rules, next state depending on multiple parts of current state.

```tsx
type State = { count: number; step: number };

type Action =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'setStep'; step: number }
  | { type: 'reset' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'increment': return { ...state, count: state.count + state.step };
    case 'decrement': return { ...state, count: state.count - state.step };
    case 'setStep':   return { ...state, step: action.step };
    case 'reset':     return { count: 0, step: 1 };
    default: {
      const _exhaustive: never = action;
      return state;
    }
  }
}

const [state, dispatch] = useReducer(reducer, { count: 0, step: 1 });
```

`useReducer` infers both `State` and `Action` from the reducer's signature — annotate the
reducer, not the hook call.

### Deriving Action from action creators

Keeps creators and the union in sync automatically, so adding a creator can't leave the
reducer stale:

```tsx
const actions = {
  updateEmail: (value: string) => ({ type: 'updateEmail', value }) as const,
  submit:      ()              => ({ type: 'submit' }) as const,
  failure:     (message: string) => ({ type: 'failure', message }) as const,
};

type Action = ReturnType<(typeof actions)[keyof typeof actions]>;
type Dispatch = React.Dispatch<Action>;

dispatch(actions.updateEmail(e.currentTarget.value));
```

The `as const` on each return is what preserves the literal `type` field — without it you get
`{ type: string }` and lose the discriminant.

### State + reducer over context

Split state and dispatch into two contexts. `dispatch` is referentially stable, so components
that only dispatch never re-render when state changes:

```tsx
const StateContext = createContext<State | null>(null);
const DispatchContext = createContext<Dispatch | null>(null);

export function TodoProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <StateContext value={state}>
      <DispatchContext value={dispatch}>{children}</DispatchContext>
    </StateContext>
  );
}
```

No `useMemo` needed on either value here: `state` is a new object only when it actually
changed, and `dispatch` is stable by contract.

## Derived state

Compute during render. Don't mirror it into state — that's a second source of truth that
goes stale and needs an effect to resynchronize.

```tsx
// ✅
const visible = todos.filter((t) => (filter === 'all' ? true : filter === 'done' ? t.done : !t.done));

// ❌ two sources of truth + a sync effect that will eventually be wrong
const [visible, setVisible] = useState<Todo[]>([]);
useEffect(() => { setVisible(todos.filter(…)); }, [todos, filter]);
```

Only wrap in `useMemo` if the computation is genuinely expensive or the result is a dependency
of another hook.

## Data from the network

The type annotation on a response is a claim the compiler cannot check:

```tsx
const data = await res.json();      // any
return data as User;                // a lie the compiler now believes
```

Validate at the boundary and derive the type from the schema, so type and runtime check
can't diverge:

```tsx
import { z } from 'zod';

const UserSchema = z.object({ id: z.number(), name: z.string(), email: z.email() });
type User = z.infer<typeof UserSchema>;

async function fetchUser(id: number): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return UserSchema.parse(await res.json());
}
```

Same applies to `localStorage`, URL/search params, `postMessage`, and env vars.

### Errors are `unknown`

In a `catch`, the value is `unknown` (with `useUnknownInCatchVariables`, part of `strict`).
Narrow before use:

```tsx
catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  setState({ status: 'error', error: new Error(message) });
}
```

### Effects that fetch

Guard against out-of-order responses and setState-after-unmount:

```tsx
useEffect(() => {
  const controller = new AbortController();
  setState({ status: 'loading' });

  fetchUser(id, controller.signal)
    .then((data) => setState({ status: 'success', data }))
    .catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setState({ status: 'error', error });
    });

  return () => controller.abort();
}, [id]);
```

Beyond a couple of call sites this is what a data-fetching library (TanStack Query, RTK Query,
the framework's own loader) exists for — caching, dedup, and revalidation are not worth
reimplementing by hand.
