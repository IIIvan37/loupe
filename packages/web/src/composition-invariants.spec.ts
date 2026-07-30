import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * ADR 0010 — the composition ratchets. Three mechanical invariants on the web
 * tree that Sheriff (dependency direction) and react-doctor (per-file lint)
 * cannot see: they catch state that should live in a feature atom leaking back
 * into the shell as props. Each threshold starts at the measured present and
 * only ever descends, one notch per Mikado leaf — like `docs/docs.spec.ts`'s
 * line-count ratchet. A migration that lowers a count lowers its bound in the
 * same PR; nothing may raise one.
 *
 * The end state the ADR names is zero `ReturnType<typeof useX>` props — the
 * shell composing values, not passing whole hook bags.
 */

// ── Ratchets — LOWER as leaves land, NEVER raise. ───────────────────────────
/** Props typed `ReturnType<typeof useX>` — passing a hook's whole return bag
 * instead of the values needed. Target: 0. */
const MAX_RETURN_TYPE_PROPS = 7
/** Fields on the widest `*Props` type (today `HeaderProps`). */
const MAX_PROPS_FIELDS = 20
/** Hooks called in the busiest component (today the workstation shell). */
const MAX_HOOKS_PER_COMPONENT = 25

const WEB_SRC = fileURLToPath(new URL('.', import.meta.url))

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return sourceFiles(path)
    }
    const isSource = /\.tsx?$/.test(entry.name)
    const isTestOrTypes = /\.spec\.tsx?$|\.d\.ts$/.test(entry.name)
    return isSource && !isTestOrTypes ? [path] : []
  })
}

function parse(path: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
}

const FILES = sourceFiles(WEB_SRC)

/** A hook call is a call whose callee is a bare identifier `use…`. */
function isHookCall(node: ts.Node): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    /^use[A-Z]/.test(node.expression.text)
  )
}

/** A component is a PascalCase function (declaration or arrow assigned to a
 * PascalCase const) — the units the "hooks per component" bound ranges over. */
function isPascal(name: string | undefined): boolean {
  return name !== undefined && /^[A-Z]/.test(name)
}

describe('ADR 0010 — composition ratchets', () => {
  it(`has at most ${MAX_RETURN_TYPE_PROPS} props typed ReturnType<typeof useX> (target 0)`, () => {
    const offenders: string[] = []
    for (const path of FILES) {
      const sf = parse(path)
      const visit = (node: ts.Node): void => {
        if (
          ts.isPropertySignature(node) &&
          node.type &&
          /^ReturnType<typeof use/.test(node.type.getText(sf))
        ) {
          offenders.push(`${path}: ${node.name.getText(sf)}`)
        }
        ts.forEachChild(node, visit)
      }
      visit(sf)
    }
    expect(
      offenders.length,
      `props passing a whole hook return:\n${offenders.join('\n')}`
    ).toBeLessThanOrEqual(MAX_RETURN_TYPE_PROPS)
  })

  it(`keeps the widest *Props type at most ${MAX_PROPS_FIELDS} fields`, () => {
    let widest = { name: '', count: 0 }
    for (const path of FILES) {
      const sf = parse(path)
      const visit = (node: ts.Node): void => {
        const named =
          (ts.isInterfaceDeclaration(node) ||
            ts.isTypeAliasDeclaration(node)) &&
          node.name.text.endsWith('Props')
        if (named && ts.isInterfaceDeclaration(node)) {
          const count = node.members.length
          if (count > widest.count) {
            widest = { name: node.name.text, count }
          }
        }
        if (
          named &&
          ts.isTypeAliasDeclaration(node) &&
          ts.isTypeLiteralNode(node.type)
        ) {
          const count = node.type.members.length
          if (count > widest.count) {
            widest = { name: node.name.text, count }
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(sf)
    }
    expect(
      widest.count,
      `widest *Props is ${widest.name} (${widest.count} fields)`
    ).toBeLessThanOrEqual(MAX_PROPS_FIELDS)
  })

  it(`keeps the busiest component at most ${MAX_HOOKS_PER_COMPONENT} hooks`, () => {
    let busiest = { name: '', count: 0 }
    // Count hook calls lexically inside a component, but stop at a nested
    // component boundary so its hooks are attributed to it, not the parent.
    function countHooks(body: ts.Node, self: ts.Node): number {
      let n = 0
      const walk = (node: ts.Node): void => {
        if (node !== self && isComponentLike(node)) {
          return // nested component owns its own hooks
        }
        if (isHookCall(node)) {
          n++
        }
        ts.forEachChild(node, walk)
      }
      ts.forEachChild(body, walk)
      return n
    }
    function isComponentLike(node: ts.Node): boolean {
      if (ts.isFunctionDeclaration(node)) {
        return isPascal(node.name?.text)
      }
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) ||
          ts.isFunctionExpression(node.initializer))
      ) {
        return isPascal(node.name.text)
      }
      return false
    }
    function nameOf(node: ts.Node): string {
      if (ts.isFunctionDeclaration(node)) {
        return node.name?.text ?? '?'
      }
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        return node.name.text
      }
      return '?'
    }
    for (const path of FILES) {
      const sf = parse(path)
      const visit = (node: ts.Node): void => {
        if (isComponentLike(node)) {
          const count = countHooks(node, node)
          if (count > busiest.count) {
            busiest = { name: `${nameOf(node)} (${path})`, count }
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(sf)
    }
    expect(
      busiest.count,
      `busiest component is ${busiest.name} with ${busiest.count} hooks`
    ).toBeLessThanOrEqual(MAX_HOOKS_PER_COMPONENT)
  })
})
