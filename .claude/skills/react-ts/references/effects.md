# Effects: when not to use one

Adapted from [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect).

**The test:** code that runs because the component was *displayed* belongs in an Effect.
Everything else belongs in an event handler or in render.

An Effect is a synchronization escape hatch to systems outside React. If nothing outside
React is involved, an Effect is almost certainly the wrong tool. Each unnecessary Effect adds
a render pass, a stale-closure risk, and a dependency array to keep correct.

## The ten cases that don't need an Effect

### 1. Transforming data for rendering

```tsx
// ❌ extra render, and `visible` is briefly wrong on every change
const [visible, setVisible] = useState<Todo[]>([]);
useEffect(() => { setVisible(todos.filter((t) => !t.done)); }, [todos]);

// ✅ compute during render
const visible = todos.filter((t) => !t.done);
```

### 2. Reacting to a user event

```tsx
// ❌ "why did this POST fire?" — the cause is buried in a dependency
useEffect(() => {
  if (submitted) post('/api/orders', order);
}, [submitted, order]);

// ✅ the cause is the click, so the code lives in the click
function handleSubmit() {
  post('/api/orders', order);
}
```

The giveaway is a boolean state variable that exists only to trigger an Effect.

### 3. Deriving state from props or state

```tsx
// ❌ redundant state + a sync Effect
const [fullName, setFullName] = useState('');
useEffect(() => { setFullName(`${first} ${last}`); }, [first, last]);

// ✅
const fullName = `${first} ${last}`;
```

If a value is computable from props and state, it isn't state. See `state.md` (Derived state).

### 4. Caching an expensive computation

```tsx
// ❌ state + Effect as a cache
const [filtered, setFiltered] = useState<Todo[]>([]);
useEffect(() => { setFiltered(expensiveFilter(todos, filter)); }, [todos, filter]);

// ✅
const filtered = useMemo(() => expensiveFilter(todos, filter), [todos, filter]);
```

Measure before reaching for `useMemo` — most computations are cheap enough to run plainly
(case 1). With the React Compiler enabled, this memoization is usually inserted for you.

### 5. Resetting all state when a prop changes

```tsx
// ❌ renders once with the previous user's state, then clears it
useEffect(() => { setComment(''); }, [userId]);

// ✅ a different key is a different component instance — React resets it for you
<Profile userId={userId} key={userId} />
```

### 6. Adjusting *some* state when a prop changes

The rare case where you want to keep most state but reset part of it. Prefer removing the
need entirely — store an id and derive the rest:

```tsx
// ✅ best: nothing to reset
const [selectedId, setSelectedId] = useState<string | null>(null);
const selected = items.find((i) => i.id === selectedId) ?? null;
```

If you genuinely can't, adjust during render rather than in an Effect — React re-runs the
component immediately without painting the intermediate state:

```tsx
const [prevItems, setPrevItems] = useState(items);
if (items !== prevItems) {
  setPrevItems(items);
  setSelection(null);
}
```

This is legitimate but easy to get wrong. Reach for it last.

### 7. Sharing logic between event handlers

```tsx
// ❌ fires on mount and on every re-mount, not only when the user acts
useEffect(() => { if (product) logVisit(product.id); }, [product]);

// ✅ a plain function called from each handler
function buy(product: Product) { logPurchase(product.id); addToCart(product); }
```

### 8. Notifying the parent of a state change

```tsx
// ❌ parent updates one render late
useEffect(() => { onChange(isOn); }, [isOn, onChange]);

// ✅ both updates in the same event, one render pass
function handleClick() {
  const next = !isOn;
  setIsOn(next);
  onChange(next);
}
```

### 9. Passing data up to the parent

If the parent needs the data, the parent should fetch it and pass it down. A child that
fetches and then reports upward makes the data flow run backwards and is hard to follow.

### 10. Chains of Effects that trigger each other

Each link is a separate render, the sequence is fragile, and adding a step means re-deriving
the whole chain. Compute what you can during render, and set the several state variables
together in the one event handler that caused the change.

## What Effects *are* for

- **Synchronizing with a non-React system** — a map widget, a chart library, a `<canvas>`,
  a media element, an imperative third-party API.
- **Subscribing to an external store** — prefer `useSyncExternalStore` over a hand-written
  subscribe/unsubscribe Effect; it handles tearing and SSR correctly.
- **Fetching data** — legitimate, but needs cleanup against race conditions (see `state.md`).
  In an app with a framework loader or a query library, use that instead.
- **Analytics on display** — an Effect is right, because the cause really is "it was shown".
  Expect it to run twice in development under Strict Mode.
- **App initialization** — module-level code or a top-level guard is usually better than an
  Effect, which runs per mount.

## Reviewing an Effect

Ask in order:

1. **Does it set state from props or state?** → compute during render.
2. **Is the real trigger a user action?** → move it into the handler.
3. **Does it reset state when a prop changes?** → `key`.
4. **Does it call a parent callback?** → call it in the handler that caused the change.
5. **Does it exist only because another Effect ran?** → collapse the chain.
6. **Does it synchronize with something outside React?** → keep it, and write the cleanup.

An empty dependency array is worth a second look: it usually means "on mount", which is a
lifecycle idea rather than a synchronization one, and it's where stale closures live.
