# Events and forms

## Event types

React wraps native events in `SyntheticEvent`. The generic parameter is the element the
handler is attached to.

| Type | Fires on | Typical element |
|---|---|---|
| `ChangeEvent<T>` | value changes | `HTMLInputElement`, `HTMLSelectElement`, `HTMLTextAreaElement` |
| `FormEvent<T>` | submit, reset | `HTMLFormElement` |
| `MouseEvent<T>` | click, hover, drag start | any |
| `KeyboardEvent<T>` | key down/up | focusable elements |
| `FocusEvent<T>` | focus, blur | focusable elements |
| `PointerEvent<T>` | unified mouse/touch/pen | any |
| `DragEvent<T>` | drag and drop | any |
| `ClipboardEvent<T>` | copy, paste | any |
| `CompositionEvent<T>` | IME composition | text inputs |
| `SyntheticEvent<T>` | fallback | any |

```tsx
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
};

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setEmail(e.currentTarget.value);
};

const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Escape') e.currentTarget.blur();
  if (e.key === 'Enter' && e.metaKey) submit();
};
```

**Inline handlers are inferred — don't annotate them.** The JSX attribute already carries the
type:

```tsx
<input onChange={(e) => setEmail(e.currentTarget.value)} />       // ✅ e is typed
<input onChange={(e: React.ChangeEvent<HTMLInputElement>) => …} /> // ❌ redundant
```

Annotate only handlers declared separately from the JSX, where there's nothing to infer from.

### `currentTarget` vs `target`

- **`currentTarget`** — the element the handler is attached to. Typed as your generic `T`. Use this.
- **`target`** — whatever was actually clicked, possibly a descendant. Typed as `EventTarget`,
  which has no `value`, no `className`, nothing useful.

```tsx
const bad  = (e: React.MouseEvent) => e.target.value;          // ❌ not on EventTarget
const good = (e: React.ChangeEvent<HTMLInputElement>) => e.currentTarget.value;  // ✅
```

`e.target` is legitimate for event delegation and backdrop-click detection, where the point
*is* to know what was hit. Assert deliberately there:

```tsx
const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
  if (e.target === e.currentTarget) onClose();   // no assertion needed — identity check
};

const handleListClick = (e: React.MouseEvent<HTMLUListElement>) => {
  const item = (e.target as HTMLElement).closest('li');
  if (!item) return;
  onSelect(item.dataset.id);
};
```

### Handler type aliases

React ships them, and they're shorter when typing a prop:

```tsx
type Props = {
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
};
// React.MouseEventHandler<T> === (event: React.MouseEvent<T>) => void
```

For **your own** callback props, prefer domain values over events — the parent shouldn't care
that the value came from an input:

```tsx
type SearchProps = {
  onSearch: (query: string) => void;              // ✅
  // onSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;   // ❌ leaks the DOM
};
```

### Native vs synthetic

Listeners added with `addEventListener` receive **native** events, not React's. In a `.tsx`
file the imported React types shadow the DOM globals, so qualify:

```tsx
useEffect(() => {
  const onKey = (e: globalThis.KeyboardEvent) => {   // native, not React's
    if (e.key === 'Escape') onClose();
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}, [onClose]);
```

## Number inputs return strings

`<input type="number">` gives you a `string` through the DOM API. Always. Convert explicitly
and handle both edge cases: empty string and `NaN`.

```tsx
const handleAmount = (e: React.ChangeEvent<HTMLInputElement>) => {
  const raw = e.currentTarget.value;
  if (raw === '') { setAmount(null); return; }     // let the field be empty
  const n = Number(raw);
  if (!Number.isNaN(n)) setAmount(n);              // ignore junk, keep last good value
};
```

`Number('')` is `0`, not `NaN` — so an empty field silently becomes zero unless you handle it
first. Modelling the state as `number | null` is usually more honest than coercing to `0`.

A reusable hook:

```tsx
function useNumberInput(initial: number | null = null) {
  const [value, setValue] = useState<number | null>(initial);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.currentTarget.value;
    if (raw === '') { setValue(null); return; }
    const n = Number(raw);
    if (!Number.isNaN(n)) setValue(n);
  };

  return { value: value ?? '', onChange, numericValue: value, setValue };
}
```

The same coercion trap applies to `<input type="date">` (string), `type="range"` (string),
and `<select>` with numeric option values (string).

## Controlled vs uncontrolled

**Controlled** — React owns the value. Default choice: validation, conditional formatting,
and cross-field logic all need the value during render.

```tsx
const [email, setEmail] = useState('');
<input value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
```

**Uncontrolled** — the DOM owns the value; read it on submit. Fewer re-renders, less code
for forms you only read once.

```tsx
function LoginForm({ onSubmit }: { onSubmit: (data: { email: string }) => void }) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    onSubmit({ email: String(form.get('email') ?? '') });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" defaultValue="" required />
      <button type="submit">Sign in</button>
    </form>
  );
}
```

`FormData.get()` returns `FormDataEntryValue | null` (`string | File | null`) — narrow it,
don't assert. That's the type system correctly reporting that a `name` might not match anything.

**Never switch a field between the two** (`value={x ?? undefined}`) — React warns, and the
input silently stops updating.

## Multiple fields, one handler

```tsx
type FormState = { name: string; email: string };

const [form, setForm] = useState<FormState>({ name: '', email: '' });

const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  const { name, value } = e.currentTarget;
  setForm((prev) => ({ ...prev, [name]: value }));
};

<input name="name" value={form.name} onChange={handleChange} />
<input name="email" value={form.email} onChange={handleChange} />
```

The computed key `[name]` isn't checked against `keyof FormState` — a typo in the `name`
attribute adds a junk property silently. For a per-field typed setter:

```tsx
const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
  setForm((prev) => ({ ...prev, [key]: value }));

<input value={form.email} onChange={(e) => setField('email', e.currentTarget.value)} />
```

## Submission

Guard against double-submit, and model the phase as a union rather than a boolean pair:

```tsx
type Submission =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error'; message: string };

const [submission, setSubmission] = useState<Submission>({ status: 'idle' });

const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  if (submission.status === 'submitting') return;

  setSubmission({ status: 'submitting' });
  try {
    await save(form);
    setSubmission({ status: 'idle' });
  } catch (error) {
    setSubmission({
      status: 'error',
      message: error instanceof Error ? error.message : 'Something went wrong',
    });
  }
};
```

## Validation

TypeScript validates nothing at runtime. Use a schema and derive the type from it, so the
two can't diverge:

```tsx
import { z } from 'zod';

const ContactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Invalid email'),
  age: z.coerce.number().int().min(0).max(120),   // coerce handles the string-from-DOM problem
});

type Contact = z.infer<typeof ContactSchema>;

const result = ContactSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
if (!result.success) {
  setErrors(z.flattenError(result.error).fieldErrors);
  return;
}
submit(result.data);   // typed as Contact
```

`safeParse` over `parse` in event handlers — you want a result to render, not an exception.

Past ~5 fields, or with cross-field rules and dirty/touched tracking, use React Hook Form
(with `@hookform/resolvers` for the schema). Hand-rolled form state stops being worth it fast.

## IME composition

For CJK and other IME input, `onChange` fires mid-composition with partial text. Skip
expensive reactions until composition ends:

```tsx
const [composing, setComposing] = useState(false);

<input
  value={query}
  onChange={(e) => {
    setQuery(e.currentTarget.value);
    if (!composing) search(e.currentTarget.value);   // don't search on partial input
  }}
  onCompositionStart={() => setComposing(true)}
  onCompositionEnd={(e) => {
    setComposing(false);
    search(e.currentTarget.value);
  }}
/>
```

Relevant to any search-as-you-type or autocomplete field with international users.
