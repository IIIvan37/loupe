# Session — 2026-06-28 — remove-starter-example

Remove the starter template's placeholder: the `greet <name>` example slice and
the whole `@app/cli` package, now that loupe is a real web app.

## Done
- **Deleted `packages/cli`** entirely (the `greet` Node adapter + entrypoint).
- **Deleted the `greet`/`greeting` slice from the core**: `application/greet.ts`
  (+ spec), `domain/greeting.ts` (+ spec), and the `NameSource` / `GreetingSink`
  ports. Pruned the matching exports from `packages/core/src/index.ts`.
- **Config**: dropped `packages/cli` from `tsconfig.json`, the `cli`
  entry-point/module/dep-rule from `sheriff.config.ts`, and the now-unused `tsx`
  dev-dependency (knip flagged it); refreshed the vitest coverage comment.
- **Docs**: retargeted `README.md` and `CLAUDE.md` from the "reusable starter /
  greet example" framing to loupe (core + web); updated the use-case/port registry
  (`application/README.md`, also fixed the stale marker-kinds note) and the
  `new-feature-hexa` skill's adapter step (cli → web). `docs/STATUS.md` notes the
  removal.

## Not done / remaining
- `docs/sessions/*` historical reports still mention `greet` in passing — left
  as-is (append-only history).

## Decisions
- The starter example is gone; **`packages/web` is the only adapter**. New
  adapters follow the same recipe against the core's public ports.

## Gate status
- typecheck: ✅
- tests (with coverage): ✅ 161 passed (24 files; −9 from the removed greet specs)
- mutation (Stryker, local — core touched by deletions): ✅ 96.06% overall (≥ 80
  break). No new logic; deletions only.
- biome / sheriff / knip / jscpd / impeccable / react-doctor: ✅ (Sheriff clean
  without the cli boundary; knip clean after dropping `tsx`).

## State to resume from
- **Single next action**: open the PR for `chore/remove-starter-example` and merge.
- Gotchas / half-done edits: none. Jalon 2 (séparation IA) is the next real step.
