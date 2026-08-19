# Domain Docs

How the engineering skills should consume this repo's domain documentation when
exploring the codebase. Layout: **single-context**.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the glossary of domain terms.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.
  `docs/adr/README.md` indexes them by subject and `docs/adr/_TEMPLATE.md`
  is the shape a new one takes.

If any of these files don't exist, **proceed silently**. Don't flag their
absence; don't suggest creating them upfront. The `/domain-modeling` skill
(reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates
them lazily when terms or decisions actually get resolved.

## In this repo

`CONTEXT.md` does not exist yet — the vocabulary currently lives in the code
(the domain model under `packages/core/src/domain`, and the use-case registry
`packages/core/src/application/README.md`) and in the ADRs. Read those instead
until a `CONTEXT.md` gets written.

Two neighbouring documents are not domain docs but bound the work all the same:

- `docs/STATUS.md` — the present state and the next action, bounded by
  `docs/docs.spec.ts`. Snapshot, never a log.
- `CLAUDE.md` — the working method, the hexagonal invariants, and the gate.

`CLAUDE.md`, `docs/STATUS.md`, `docs/adr/README.md` and the in-tree registry
READMEs are **living docs**: `docs/docs.spec.ts` fails when they name a path
that does not exist. Keep their file mentions true.

## File structure

```
/
├── CLAUDE.md
├── docs/
│   ├── STATUS.md
│   ├── adr/
│   └── agents/
└── packages/
    ├── core/
    └── web/
```

The monorepo has two packages, but one domain: the hexagon in
`packages/core` is the single context, and `packages/web` is its adapter.
That is why this is a single-context repo despite the `packages/*` layout —
the ADRs under `docs/adr/` are transverse to both.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor
proposal, a hypothesis, a test name), use the term as defined in the domain
model. Don't drift to synonyms the project explicitly avoids.

If the concept you need isn't there yet, that's a signal — either you're
inventing language the project doesn't use (reconsider) or there's a real gap
(note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than
silently overriding:

> _Contradicts ADR-0007 — but worth reopening because…_
