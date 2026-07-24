// Test-support surface of the core, consumed by adapter SPECS through
// `@app/core/testing`. Kept out of `src/index.ts` on purpose: production code
// must not be able to import a fake (Sheriff tag `core:testing` + the Biome
// override on packages/web), and this subtree is the only core code allowed
// to depend on vitest. Fakes of still-in-nursery ports live directly here;
// each module extraction (TS.5) takes its ports, contracts and fakes along.

export { createInMemoryProjectStore } from './in-memory-project-store.ts'
export type { ProjectStoreSubject } from './project-store-contract.ts'
export { projectStoreContract } from './project-store-contract.ts'
