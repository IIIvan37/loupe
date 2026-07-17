import { type Project, parseProject } from '@app/core'

/**
 * The shared decode edge for persisted manifests (AA.2): both project store
 * adapters (filesystem and HTTP) speak the same two contracts — a listed
 * manifest that fails validation is skipped (one broken file never breaks
 * the dialog) with a console trace for observability, and a loaded-by-id
 * manifest that fails is « unreadable », a distinct error from « unknown »
 * so corruption is never mistaken for absence.
 */

export function unreadableManifestError(id: string): Error {
  return new Error(`Unreadable project manifest "${id}"`)
}

/** Decode a list of raw manifests, dropping (and tracing) the broken ones. */
export function readableProjects(manifests: readonly unknown[]): Project[] {
  const projects: Project[] = []
  let skipped = 0
  for (const manifest of manifests) {
    const project = parseProject(manifest)
    if (project === undefined) {
      skipped += 1
      continue
    }
    projects.push(project)
  }
  if (skipped > 0) {
    console.warn(
      `loupe: ${skipped} unreadable project manifest(s) hidden from the list`
    )
  }
  return projects
}
