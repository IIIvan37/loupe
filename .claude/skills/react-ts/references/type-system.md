# TypeScript mechanics for React

## Inference: where to stop annotating

Annotate **inputs** (props, function parameters, empty containers, nullable state).
Let TypeScript infer **outputs** (return types, derived values, JSX).

```tsx
// ✅ inputs annotated, outputs inferred
function useCounter(initial: number) {
  const [count, setCount] = useState(initial);
  const increment = useCallback(() => setCount((c) => c + 1), []);
  return { count, increment };
}

// ❌ restating what's already known
function useCounter(initial: number): { count: number; increment: () => void } { … }
```

An annotation that duplicates the implementation drifts from it. The exception: annotate a
return type deliberately to *narrow* the public surface, or to get a better error location
(errors point at the return statement rather than the call site).

### Widening

TypeScript widens literals in mutable positions:

```ts
let status = 'idle';                     // string
const status = 'idle';                   // 'idle'
const config = { status: 'idle' };       // { status: string }  ← widened
const config = { status: 'idle' } as const;  // { readonly status: 'idle' }
```

This is why `useState('idle')` gives `string`, and why config objects lose their literal types
without `as const`.

## `as const` and `satisfies`

**`as const`** freezes to literal types. Deriving a union from a runtime array keeps the two
in sync — one source of truth:

```ts
const SIZES = ['sm', 'md', 'lg'] as const;
type Size = (typeof SIZES)[number];      // 'sm' | 'md' | 'lg'

SIZES.map((s) => <option key={s}>{s}</option>);   // iterate the same list
```

**`satisfies`** checks a value against a type *without* widening it to that type:

```ts
// ❌ annotation: validated, but every value is now just `string`
const theme: Record<string, string> = { primary: '#3b82f6', danger: '#ef4444' };
theme.typo;              // no error — Record<string, string> allows any key

// ✅ satisfies: validated AND keys/values stay literal
const theme = { primary: '#3b82f6', danger: '#ef4444' } satisfies Record<string, string>;
theme.typo;              // error: property doesn't exist
type Primary = typeof theme.primary;   // '#3b82f6'
```

Combine for lookup tables — the workhorse pattern for variant styles:

```ts
const buttonStyles = {
  primary: 'bg-blue-500 text-white',
  secondary: 'bg-gray-200 text-gray-900',
  danger: 'bg-red-500 text-white',
} as const satisfies Record<Variant, string>;
```

`satisfies` verifies every `Variant` is covered — add a variant and this errors until you
handle it. A plain object wouldn't catch that.

## Narrowing

TypeScript follows control flow. Prefer narrowing over assertions everywhere.

```ts
if (typeof value === 'string')     // typeof — primitives
if (value instanceof Error)        // instanceof — classes
if ('href' in props)               // in — union members without a discriminant
if (state.status === 'success')    // literal comparison — discriminated unions
if (!user) return null;            // truthiness + early return
```

Early returns narrow the rest of the function, which reads better than nesting:

```tsx
function Profile({ user }: { user: User | null }) {
  if (!user) return <Login />;
  return <div>{user.name}</div>;     // user: User from here on
}
```

### Type guards

When the check isn't expressible inline, name it. The `x is T` return type is what makes
narrowing propagate:

```ts
function isNonNull<T>(value: T | null | undefined): value is T {
  return value != null;
}

const users = results.filter(isNonNull);   // User[], not (User | null)[]
```

`filter(Boolean)` does **not** narrow — the result stays `(User | null)[]`. Use a guard.

### Assertion functions

For invariants that should throw:

```ts
function assertDefined<T>(value: T | undefined, message: string): asserts value is T {
  if (value === undefined) throw new Error(message);
}

assertDefined(user, 'user must be loaded');
user.name;   // narrowed from here
```

Assertion functions need an explicit type annotation on the containing `const` if you assign
them to a variable — a known TypeScript limitation. Declare them as `function`.

### Narrowing loss

Narrowing is invalidated by function boundaries, because TypeScript can't prove the value
didn't change:

```tsx
if (ref.current) {
  setTimeout(() => ref.current.focus(), 0);    // ❌ ref.current possibly null again
}

const el = ref.current;
if (el) {
  setTimeout(() => el.focus(), 0);             // ✅ captured in a const
}
```

Same for object properties that could be mutated between the check and the use. Capture into
a `const`.

## `unknown` vs `any`

- **`any`** switches off type checking for that value *and everything derived from it*. It
  spreads silently through a codebase.
- **`unknown`** is the honest top type: assignable from anything, usable only after narrowing.

```ts
const data: unknown = await res.json();
data.name;                                   // error — good
if (isUser(data)) data.name;                 // ok after narrowing
```

Use `unknown` for: `JSON.parse` results, API responses, `catch` bindings, third-party data,
`postMessage` payloads. If you're reaching for `any`, the question is what check is missing.

`catch (e)` is already `unknown` under `strict` (`useUnknownInCatchVariables`):

```ts
catch (error) {
  const message = error instanceof Error ? error.message : String(error);
}
```

### Assertions

`as` tells the compiler to stop checking. It doesn't make anything true, and it's the most
common way type-safe codebases develop runtime errors.

```ts
const user = data as User;                     // ❌ a claim, not a check
const user = UserSchema.parse(data);           // ✅ verified
```

Legitimate uses, all narrow and local: DOM queries the compiler can't know
(`document.getElementById('x') as HTMLInputElement`), `e.target` in delegation, and
internal spreads in polymorphic components. Never as a way to make an error go away.

`as unknown as T` (double assertion) means the types are genuinely unrelated. It is almost
always a design problem.

## Utility types in React

| Type | Use |
|---|---|
| `Pick<T, K>` | a component that needs part of a domain type |
| `Omit<T, K>` | props minus what you're replacing or handling internally |
| `Partial<T>` | update/patch payloads, optional overrides |
| `Required<T>` | after applying defaults |
| `Record<K, V>` | lookup tables, dictionaries |
| `ReturnType<typeof f>` | deriving `Action` from action creators |
| `Parameters<typeof f>` | wrapping a function while keeping its signature |
| `Awaited<T>` | the resolved type of a promise |
| `NonNullable<T>` | after a null check at a type level |
| `React.ComponentProps<typeof C>` | reusing another component's props |

Derive rather than restate — a duplicated shape is a shape that will diverge:

```tsx
type User = { id: string; name: string; email: string; passwordHash: string; isAdmin: boolean };

function UserCard(props: Pick<User, 'id' | 'name' | 'email'>) { … }
function updateUser(id: string, patch: Partial<Omit<User, 'id'>>) { … }
```

`Omit` doesn't error on keys that don't exist — `Omit<User, 'emial'>` silently omits nothing.
If that matters, constrain: `Omit<User, keyof User & 'email'>`, or just be careful.

## Mapped and conditional types

Useful, but each one costs readability and compile time. Reach for them when the alternative
is real duplication.

**Mapped** — transform every property:

```ts
type FormState<T> = {
  [K in keyof T]: { value: T[K]; error?: string; touched: boolean };
};

type Handlers<T> = {
  [K in keyof T as `on${Capitalize<string & K>}Change`]: (value: T[K]) => void;
};
// { onNameChange: (value: string) => void; onAgeChange: (value: number) => void }
```

**Conditional** — branch at the type level:

```ts
type Unwrap<T> = T extends Promise<infer U> ? U : T;
```

Keep them shallow. Nested conditionals produce error messages nobody can read, and the type
that saves five lines of duplication but costs an hour of debugging isn't a win. Break complex
types into named intermediates — they're documentation, and they show up in error messages.

## Template literal types

Precise string shapes, most useful for design-token props:

```ts
type Spacing = 1 | 2 | 4 | 8;
type Margin = `m${'t' | 'r' | 'b' | 'l' | 'x' | 'y' | ''}-${Spacing}`;
// 'mt-1' | 'mt-2' | … | 'm-8'
```

Beware combinatorial explosion — the union above is 28 members, but a few more axes and you
hit TypeScript's 100,000-member limit and compile times collapse.

## Generics

Only when the type genuinely varies per call site:

```tsx
function useFetch<T>(url: string): AsyncState<T> { … }
const { data } = useFetch<User>('/api/user');
```

Constrain to document intent and enable property access:

```ts
function byId<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find((item) => item.id === id);
}
```

Default type parameters keep simple call sites simple: `function useFetch<T = unknown>(…)`.

A generic used with exactly one type isn't a generic — it's indirection. Inline it.

In `.tsx`, arrow-function generics need a trailing comma (`<T,>`) or TypeScript parses `<T>`
as JSX. Prefer `function` declarations.

## Compiler options

```jsonc
{
  "compilerOptions": {
    "strict": true,                      // start here, always
    "noUncheckedIndexedAccess": true,    // arr[i] and obj[key] are T | undefined
    "noImplicitReturns": true,           // every branch returns
    "verbatimModuleSyntax": true,        // forces `import type`; no surprise runtime imports
    "jsx": "react-jsx",                  // no React import needed
    "moduleResolution": "bundler",
    "isolatedModules": true,             // required by esbuild/SWC transpilers
    "skipLibCheck": true                 // don't typecheck node_modules
  }
}
```

`strict: true` enables `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`,
`strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, and
`useUnknownInCatchVariables`. `strictNullChecks` alone catches more React bugs than the rest
combined.

**`noUncheckedIndexedAccess`** is the highest-value non-default. `items[0]` really can be
`undefined`, and pretending otherwise is where `Cannot read properties of undefined` comes from.
It's noisy on array-heavy code — worth it anyway.

**`exactOptionalPropertyTypes`** distinguishes "absent" from "explicitly undefined". Correct,
but it fights common React idioms (`{...(cond && { prop })}`, spreading partial props). Adopt
it only if the team is committed.

Vite and `create-vite` templates ship most of this. Verify rather than assume.

### Migrating an existing codebase

`noImplicitAny` → `strictNullChecks` → the rest. Per-directory via project references or a
second `tsconfig` if a big-bang flip is impractical.

Use `// @ts-expect-error` with a reason, never `@ts-ignore`: `expect-error` fails the build
once the underlying issue is fixed, so it can't silently outlive its cause.
