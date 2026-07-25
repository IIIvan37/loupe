import type { ProjectStore } from '../application/ports.ts'
import type { Project } from '../domain/project.ts'

/**
 * Reference in-memory `ProjectStore`. It exists for two reasons: it is the
 * fake every use-case spec needs, and it is the subject the port contract is
 * validated against — so a contract the reference implementation fails is a
 * bug in the contract, not in an adapter.
 *
 * `saved` is exposed for direct assertion (did this exact manifest land?),
 * the same surface the hand-rolled spec fakes had before converging here.
 */
export function createInMemoryProjectStore(
  initial: readonly Project[] = []
): ProjectStore & { readonly saved: Map<string, Project> } {
  const saved = new Map(initial.map((p) => [p.id, p]))
  return {
    saved,
    async list() {
      return [...saved.values()]
    },
    async load(id) {
      return saved.get(id)
    },
    async save(project) {
      saved.set(project.id, project)
    },
    async delete(id) {
      saved.delete(id)
    }
  }
}
