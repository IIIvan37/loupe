# Props, children, and component APIs

## Children: which type

| Type | Accepts | Use for |
|---|---|---|
| `ReactNode` | elements, strings, numbers, arrays, fragments, portals, `null`, `undefined`, booleans | **children props — the default** |
| `ReactElement` | only JSX elements | a slot you will `cloneElement` or inspect |
| `ReactElement<P>` | elements with known props | slots where you read specific props |

```tsx
// ✅ Default: maximum flexibility for the caller
function Card({ children }: { children: React.ReactNode }) {
  return <div className="card">{children}</div>;
}
// <Card>text</Card>, <Card>{42}</Card>, <Card>{null}</Card>, <Card>{items.map(…)}</Card>

// ✅ ReactElement when you need to enhance it
function Modal({ trigger, children }: { trigger: React.ReactElement; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {cloneElement(trigger, { onClick: () => setOpen(true) })}
      {open && <div className="modal">{children}</div>}
    </>
  );
}
```

`JSX.Element` is `ReactElement<any, any>` — it loses prop types. Prefer `ReactElement`.
Don't annotate component return types; let TypeScript infer.

`PropsWithChildren<P>` is exactly `P & { children?: ReactNode }`. It's fine, but writing
`children` explicitly is clearer about whether it's required.

### Multiple slots

Named props beat convention-based children parsing — they're typed, ordered, and self-documenting.

```tsx
type LayoutProps = {
  header: React.ReactNode;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
};
```

### Manipulating children

`React.Children.map` / `.count` / `.only` exist, but they're a smell: they couple the parent
to the shape of its children. Prefer explicit slot props. If you must, guard with `isValidElement`:

```tsx
React.Children.map(children, (child) =>
  isValidElement(child) ? cloneElement(child, { className: 'enhanced' }) : child
);
```

`React.Children.only` **throws** at runtime with anything but exactly one child.

## Mirroring DOM props

Hand-listing native props is always incomplete and always drifts. Extend the element's prop type.

```tsx
type ButtonProps = React.ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
};

function Button({ variant = 'primary', loading, disabled, className, ...rest }: ButtonProps) {
  return (
    <button
      className={`btn btn--${variant} ${className ?? ''}`}
      disabled={disabled || loading}
      {...rest}
    />
  );
}
```

Destructure what you process, spread the rest. Spread `{...rest}` **before** the props you
control so yours win — or after, if you want callers to be able to override.

### Which utility type

| Type | Gives you |
|---|---|
| `ComponentProps<'button'>` | everything native, including `ref` (React 19) — **default choice** |
| `ComponentPropsWithoutRef<'button'>` | same, minus `ref` — React 18, or when you don't forward refs |
| `ComponentProps<typeof MyComponent>` | the props of another component |
| `HTMLAttributes<HTMLDivElement>` | generic attributes only, no element-specific props |
| `React.JSX.IntrinsicElements['button']` | element map; the bare `JSX.*` global is deprecated in React 19 |

`AllHTMLAttributes` exists and allows every attribute on every element. It produces bad APIs. Avoid it.

### Overriding a native prop

```tsx
type InputProps = Omit<React.ComponentProps<'input'>, 'onChange'> & {
  onChange: (value: string) => void;   // simplified signature
};

function Input({ onChange, ...rest }: InputProps) {
  return <input {...rest} onChange={(e) => onChange(e.currentTarget.value)} />;
}
```

If your prop name collides with a native one (`size`), either rename yours (`inputSize`) or
`Omit` the native one. Silent shadowing confuses callers.

## Prop unions: making invalid combinations uncompilable

Use when props are genuinely mutually exclusive — controlled vs uncontrolled, variants with
different requirements.

```tsx
type BaseProps = { children: React.ReactNode; disabled?: boolean };

type ButtonProps =
  | (BaseProps & { variant: 'button'; onClick: () => void; href?: never })
  | (BaseProps & { variant: 'link'; href: string; onClick?: never });

function Button(props: ButtonProps) {
  if (props.variant === 'link') {
    return <a href={props.href}>{props.children}</a>;   // href narrowed in
  }
  return <button onClick={props.onClick} disabled={props.disabled}>{props.children}</button>;
}
```

Two ways to narrow:
- **Discriminant property** (`props.variant === 'link'`) — clearer, preferred. Requires a literal field on every member.
- **`in` operator** (`'open' in props`) — for unions without a discriminant.

`?: never` marks a prop as forbidden in that variant, which is what turns
`<Button variant="link" onClick={…} />` into a compile error.

**Don't over-apply this.** `{ showIcon?: boolean; iconName?: string }` doesn't need to become
a union — the cost in readability and error-message quality isn't worth it for props that
aren't actually contradictory.

## Generic components

For components whose types flow through from caller data:

```tsx
type SelectProps<T> = {
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  getLabel: (option: T) => string;
  getKey: (option: T) => string | number;
};

function Select<T>({ options, value, onChange, getLabel, getKey }: SelectProps<T>) {
  return (
    <select
      value={value ? String(getKey(value)) : ''}
      onChange={(e) => {
        const found = options.find((o) => String(getKey(o)) === e.currentTarget.value);
        if (found) onChange(found);
      }}
    >
      {options.map((o) => <option key={getKey(o)} value={getKey(o)}>{getLabel(o)}</option>)}
    </select>
  );
}

<Select options={users} value={selected} onChange={setSelected}
        getLabel={(u) => u.name} getKey={(u) => u.id} />   // T inferred as User
```

Generics earn their keep when the type genuinely varies per call site. A generic that's
always instantiated with one type should just take that type.

Note the arrow-function generic ambiguity in `.tsx`: `const f = <T,>(x: T) => x` needs the
trailing comma, or TypeScript reads `<T>` as JSX. Use `function` declarations to sidestep it.

## Polymorphic components (`as` prop)

Powerful and expensive — every consumer pays in error-message quality and compile time.
Before reaching for it, ask whether two concrete components would be clearer. They usually are.

When you do need it, constrain `as` to a small set rather than all of `ElementType`:

```tsx
type TextProps<T extends 'p' | 'span' | 'h1' | 'h2'> = {
  as?: T;
  children: React.ReactNode;
} & Omit<React.ComponentProps<T>, 'as' | 'children'>;

function Text<T extends 'p' | 'span' | 'h1' | 'h2' = 'p'>({ as, children, ...rest }: TextProps<T>) {
  const Component = as ?? 'p';
  return <Component {...(rest as React.ComponentProps<typeof Component>)}>{children}</Component>;
}
```

The internal assertion is unavoidable — TypeScript can't verify the spread against a generic
element type. Keep it contained inside the component, never leaked to callers.

## Compound components

Attach subcomponents for a scoped namespace. Share state through context, not `cloneElement`.

```tsx
function Tabs({ children, defaultValue }: { children: React.ReactNode; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const ctx = useMemo(() => ({ value, setValue }), [value]);
  return <TabsContext value={ctx}>{children}</TabsContext>;
}

Tabs.List = function TabsList({ children }: { children: React.ReactNode }) {
  return <div role="tablist">{children}</div>;
};

Tabs.Trigger = function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const { value: active, setValue } = useTabs();
  return (
    <button role="tab" aria-selected={active === value} onClick={() => setValue(value)}>
      {children}
    </button>
  );
};
```

In React 19 `<Context value={…}>` works directly — `<Context.Provider>` is no longer required.

## Documenting props

JSDoc on props shows up in editor autocomplete at the call site, where it's actually useful.
Worth it for anything non-obvious — units, defaults, invariants.

```tsx
type ChartProps = {
  /** Data points, sorted by x ascending. Empty renders the "no data" state. */
  data: Array<{ x: number; y: number }>;
  /** Auto-dismiss delay in **milliseconds**. @default 5000 */
  timeout?: number;
};
```
