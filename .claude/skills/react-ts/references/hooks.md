# Hooks, refs, and context

## Custom hooks

**Return an object, not a tuple** — unless the values are genuinely positional and callers
will rename them, as with `useState`.

```tsx
// ✅ named, extensible, order-independent
function useUser(id: string) {
  const [state, setState] = useState<AsyncState<User>>({ status: 'idle' });
  return { state, refetch };
}

// ✅ tuple when renaming at the call site is the point — note `as const`
function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn((v) => !v), []);
  return [on, toggle] as const;      // without it: (boolean | (() => void))[]
}
```

**Make them generic when the type flows from the caller:**

```tsx
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : initialValue;    // still unvalidated — see state.md
  });

  const update = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const resolved = next instanceof Function ? next(prev) : next;
      window.localStorage.setItem(key, JSON.stringify(resolved));
      return resolved;
    });
  }, [key]);

  return [value, update] as const;
}
```

Let the return type be inferred; annotating it duplicates the implementation and drifts.
Annotate explicitly only when you want to *narrow* what's exposed.

**Rules that TypeScript can't enforce:** never call hooks conditionally, in loops, or after an
early return. Enable `eslint-plugin-react-hooks` — it catches this and stale dependencies,
which is the class of bug types don't see.

## useMemo / useCallback

They exist for **referential stability**, not for speed. Memoizing a cheap computation costs
more than it saves.

Use them when:
- the value is a dependency of another hook (effect, memo, callback),
- it's a prop to a `memo`-ized child,
- it's a context provider value,
- the computation is genuinely expensive (large sorts, parsing, heavy derivations).

Otherwise skip it. With the React Compiler enabled, most manual memoization becomes dead weight —
check whether the project uses it before adding more.

```tsx
// ✅ dependency of an effect
const query = useMemo(() => ({ term, page }), [term, page]);
useEffect(() => { search(query); }, [query]);

// ❌ noise
const doubled = useMemo(() => count * 2, [count]);
```

`useCallback(fn, deps)` is `useMemo(() => fn, deps)`. Setters from `useState` and `dispatch`
from `useReducer` are already stable — never list them as dependencies-driven reasons to memoize.

## Refs

**Always parameterize.** Two distinct uses, two typings:

```tsx
// DOM element — starts null, React assigns on commit
const inputRef = useRef<HTMLInputElement>(null);

// Mutable value that shouldn't trigger re-renders
const timerRef = useRef<number | undefined>(undefined);   // React 19 requires the argument
const renderCount = useRef(0);
```

**Refs are `null` during the first render.** Read them in effects or event handlers, never in
the render body:

```tsx
function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // const ctx = canvasRef.current?.getContext('2d');   // ❌ always null here

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');    // ✅ available after commit
    ctx?.fillRect(0, 0, 100, 100);
  }, []);

  return <canvas ref={canvasRef} width={200} height={200} />;
}
```

Null-check with `?.` for one-off calls, or an early return when you need the element several times:

```tsx
const measure = useCallback(() => {
  const el = boxRef.current;
  if (!el) return;
  const { width, height } = el.getBoundingClientRect();
  // el is non-null for the rest of the function
}, []);
```

### Callback refs

Use when you need to react the moment the element attaches or detaches, or when one ref
object won't do (dynamic lists).

```tsx
const measuredRef = useCallback((el: HTMLDivElement | null) => {
  if (el) setSize(el.getBoundingClientRect());
}, []);

<div ref={measuredRef}>…</div>
```

In React 19 a callback ref may return a cleanup function, which replaces the `null` call:

```tsx
const observedRef = useCallback((el: HTMLDivElement | null) => {
  if (!el) return;
  const observer = new ResizeObserver(([entry]) => setSize(entry.contentRect));
  observer.observe(el);
  return () => observer.disconnect();
}, []);
```

For a list, keep a `Map` in a ref rather than generating a new closure per item per render:

```tsx
const nodes = useRef(new Map<string, HTMLLIElement>());

<li ref={(el) => {
  if (el) nodes.current.set(item.id, el);
  else nodes.current.delete(item.id);
}} />
```

### Forwarding refs

**React 19:** `ref` is a normal prop. `forwardRef` is deprecated.

```tsx
type InputProps = React.ComponentProps<'input'> & { label: string };

function Input({ label, ref, ...rest }: InputProps) {
  return (
    <label>
      {label}
      <input ref={ref} {...rest} />
    </label>
  );
}
```

`ComponentProps<'input'>` already includes a correctly typed `ref`. For a component that isn't
a DOM wrapper, declare it: `ref?: React.Ref<HTMLInputElement>`.

**React 18:**

```tsx
type InputProps = React.ComponentPropsWithoutRef<'input'> & { label: string };

const Input = forwardRef<HTMLInputElement, InputProps>(({ label, ...rest }, ref) => (
  <label>{label}<input ref={ref} {...rest} /></label>
));
Input.displayName = 'Input';
```

`displayName` matters for React DevTools and error messages — `forwardRef` produces an
anonymous component without it.

### useImperativeHandle

For exposing a **curated API** instead of the raw element. Prefer props: an imperative handle
is an escape hatch, justified for focus management, media playback, scroll control, and
integrating imperative third-party libraries.

```tsx
type VideoHandle = {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
};

function VideoPlayer({ src, ref }: { src: string; ref?: React.Ref<VideoHandle> }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useImperativeHandle(ref, () => ({
    play:  () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
    seek:  (s) => { if (videoRef.current) videoRef.current.currentTime = s; },
  }), []);

  return <video ref={videoRef} src={src} />;
}

// consumer
const player = useRef<VideoHandle>(null);
player.current?.play();
```

Define the handle type explicitly and export it — consumers need it to type their ref.

## Context

### The pattern

Nullable default + throwing hook. This is what makes the hook's return type non-nullable.

```tsx
type ThemeValue = { theme: 'light' | 'dark'; setTheme: (t: 'light' | 'dark') => void };

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
```

- **Export the hook, not the context.** If the context is exported, someone will call
  `useContext` directly and bypass the guard.
- **Never fake the default** (`createContext({} as ThemeValue)`). It turns a loud, immediate
  "missing provider" error into a silent wrong-value bug at some distance from the cause.
- **`useMemo` the value.** Without it, every provider render produces a new object and every
  consumer re-renders.

In React 19 `<Context value={…}>` renders directly; `<Context.Provider>` still works but is legacy.

### A factory, if you have several

```tsx
export function createSafeContext<T>(name: string) {
  const Context = createContext<T | null>(null);
  Context.displayName = name;

  function useSafeContext(): T {
    const ctx = useContext(Context);
    if (ctx === null) throw new Error(`use${name} must be used within a ${name}Provider`);
    return ctx;
  }

  return [useSafeContext, Context] as const;
}

const [useAuth, AuthContext] = createSafeContext<AuthValue>('Auth');
```

### Splitting state from actions

When state changes often but actions don't, one context makes action-only consumers re-render
for nothing. Two contexts fix it:

```tsx
const StateContext = createContext<CartState | null>(null);
const ActionsContext = createContext<CartActions | null>(null);
```

`CartBadge` reads state and re-renders on change. `AddToCartButton` reads only actions and
never re-renders — provided the actions object is stable (`useMemo` with `useCallback`
members, or a `dispatch`).

### What context is not

Context is dependency injection, not a state manager. It has no selector mechanism: any change
to the value re-renders every consumer, however small the slice they use. For frequently-changing
global state with many consumers, use a store with selectors (Zustand, Redux Toolkit, Jotai)
and keep context for genuinely tree-scoped values: theme, locale, auth, feature flags.
