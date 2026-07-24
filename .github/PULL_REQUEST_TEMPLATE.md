<!--
Describe the PROBLEM first, then the change. A reviewer who does not know why
cannot tell whether the how is right.
-->

## Problem

## Changes

## Checklist

- [ ] Tests written **first** (red → green → refactor)
- [ ] `pnpm gate` green (typecheck, Biome, Sheriff, coverage, knip, jscpd)
- [ ] Core touched? `pnpm test:mutation` run locally — score reported below
- [ ] New use-case/port registered in `packages/core/src/application/README.md`
- [ ] UI copy goes through Lingui (`i18n:extract` run after changing messages)
- [ ] `/session-report` run — dated report included in the PR

## Results

<!-- Mutation score, coverage, anything measured rather than asserted. -->
