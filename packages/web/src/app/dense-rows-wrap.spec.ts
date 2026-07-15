import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Every Layout: a dense horizontal row must wrap in a narrow container, never
// overflow. jsdom computes no layout (scrollWidth is always 0), so the
// invariant is asserted on the stylesheet itself: every dense row rule below
// must declare flex-wrap: wrap, like the header and transport bar already do.
const here = dirname(fileURLToPath(import.meta.url))

const DENSE_ROWS = [
  { file: 'tempo/tempo-panel.module.css', selector: '.panel' },
  { file: 'lead-sheet/chord-chart-panel.module.css', selector: '.header' }
]

function ruleBlock(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`rule ${selector} not found`)
  return css.slice(start, css.indexOf('}', start))
}

describe('dense rows wrap (Every Layout)', () => {
  it.each(DENSE_ROWS)('$file $selector wraps', ({ file, selector }) => {
    const css = readFileSync(join(here, file), 'utf8')
    expect(ruleBlock(css, selector)).toContain('flex-wrap: wrap')
  })
})
