export const meta = {
  name: 'revue-solid',
  description: 'Revue SOLID du projet loupe : 5 enquêteurs (un par principe), vérification adversariale de chaque constat',
  whenToUse: "À la fin d'un chantier structurel, pour rejouer la revue SOLID complète ; passer en args.history 2–3 lignes sur les chantiers récents (le contexte que les enquêteurs doivent connaître). Rendement mesuré (2026-08-04) : 20 constats bruts → 14 réfutés, 6 confirmés, 0 faux positif passé.",
  phases: [
    { title: 'Find', detail: 'un enquêteur par principe SOLID' },
    { title: 'Verify', detail: 'un sceptique adversarial par constat' },
  ],
}

const CONTEXT = `
Repo: /Users/ivanduchauffour/loupe — "loupe", a browser audio practice tool.
pnpm monorepo, hexagonal architecture, TDD-strict, TypeScript, mostly FUNCTIONAL style (few classes).

Layout:
- packages/core/src — pure hexagon, no I/O. Modules: application/ (use-cases + ports), domain/, audio/, harmony/, loops/, markers/, project/, rhythm/, separation/, structure/, shared/, testing/. Public surface = src/index.ts only.
- packages/web/src — React adapter (React 19 + Jotai atoms per feature, Base UI, CSS Modules, smart/dumb components). app/ holds feature folders (lead-sheet, loops, markers, mixer, playback, transport, waveform, session, ...).
Dependency direction enforced by Sheriff + Biome: application → domain; web depends only on @app/core public API.

Recent history (what the caller wants the investigators to know):
${args?.history ?? 'None supplied — read docs/STATUS.md « Where we are » yourself before judging.'}

IMPORTANT calibration — this is idiomatic functional TypeScript, NOT Java OO:
- An exhaustive switch over a discriminated union in ONE place is IDIOMATIC, not an OCP violation. OCP violations = the same variant-dispatch duplicated across several files (shotgun surgery to add a variant).
- SRP applies to modules/functions: multiple unrelated reasons to change, mixed concerns (e.g. a use-case doing both orchestration and formatting).
- LSP applies to port implementations and test fakes: a fake or adapter whose semantics diverge from the real contract (different error behavior, no-op where real has effects, wrong value domains).
- ISP applies to ports and React props: a port/interface/props object forcing consumers to depend on members they never use.
- DIP: high-level policy depending on concrete detail. The core/web boundary is machine-enforced; look INSIDE each package (e.g. a web smart component bypassing its port, a core use-case knowing adapter-specific details, hidden coupling to a concrete store shape).
Exclude *.spec.ts(x) files except when a test fake itself is the violation. Do NOT flag things the architecture gates already enforce and that are respected.
`

const PRINCIPLES = [
  {
    key: 'srp',
    name: 'Single Responsibility',
    brief: `Hunt for SRP violations: modules or functions with several unrelated reasons to change. Look for: use-cases that both orchestrate and format/compute domain logic inline; god modules mixing concerns; React smart components doing data-fetching + business rules + presentation; files where two changes for unrelated features would collide. Check the biggest files first (wc -l is a good scout), then read them.`,
  },
  {
    key: 'ocp',
    name: 'Open/Closed',
    brief: `Hunt for OCP violations of the shotgun-surgery kind: adding one new variant (a chord quality, a directive kind, a marker kind, a stem id, an event type...) requires editing SEVERAL files because the same dispatch/branching over that variant is duplicated. Grep for repeated switch/if-else chains over the same union across files. A single exhaustive switch in one module is FINE — only flag duplicated dispatch.`,
  },
  {
    key: 'lsp',
    name: 'Liskov Substitution',
    brief: `Hunt for LSP violations: port implementations, adapters, and test fakes whose behavior diverges from the contract the consumer relies on. Compare each port declared in packages/core/src/**/application (and shared testing fakes in */testing/) with its web adapter implementation: error behavior (throw vs resolve), value domains, ordering guarantees, no-ops. Known past bug class: English fakes masked a total no-op because real stem ids are French. Also check branded types being cast around (as) which breaks substitutability guarantees.`,
  },
  {
    key: 'isp',
    name: 'Interface Segregation',
    brief: `Hunt for ISP violations: fat ports/interfaces/props. Look for: ports in packages/core/src/**/application whose consumers each use only a slice of the interface; React components with wide props objects where most props serve only one caller; a PlayerHandle or session/store surface that keeps growing so every feature depends on the whole thing; context/atom bags exposing more than consumers need.`,
  },
  {
    key: 'dip',
    name: 'Dependency Inversion',
    brief: `Hunt for DIP violations INSIDE each package (the core/web boundary itself is machine-enforced): core use-cases whose port signatures leak adapter details (browser-ish shapes, storage layouts, wire formats); web features reading another feature's Jotai atoms directly instead of going through the owning feature's handle/port (known rule: a feature that DRIVES the player must widen PlayerHandle, never read the driven feature's atoms); hidden coupling to concrete localStorage keys / store shapes spread across files; policies living in the adapter that belong in core.`,
  },
]

const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        required: ['principle', 'file', 'title', 'description', 'severity'],
        properties: {
          principle: { type: 'string' },
          file: { type: 'string', description: 'repo-relative path' },
          line: { type: 'number' },
          title: { type: 'string', description: 'one-line claim' },
          description: { type: 'string', description: 'the evidence: what the code does, why it violates the principle, concrete file:line citations' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          suggestion: { type: 'string', description: 'sketch of the fix direction' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['real', 'reasoning'],
  properties: {
    real: { type: 'boolean' },
    reasoning: { type: 'string' },
    severity: { type: 'string', enum: ['high', 'medium', 'low'], description: 'adjusted severity if real' },
  },
}

const findPrompt = (p) => `${CONTEXT}

You are the ${p.name} Principle investigator in a SOLID review of this codebase.
${p.brief}

Method: scout with Glob/Grep/wc to shortlist candidates, then READ the actual code of each candidate before flagging it. Every finding must cite concrete file:line evidence from code you read. Quality over quantity: return your TOP findings only (max 5), ranked by real maintenance cost. If the codebase is clean for this principle, return an empty list — do not invent violations to fill the quota. Severity = practical cost: high = actively causing bug risk or shotgun surgery today; medium = will hurt at the next feature touching it; low = cosmetic.`

const verifyPrompt = (f) => `${CONTEXT}

You are an adversarial verifier in a SOLID review. A reviewer claims this ${f.principle} violation:

Title: ${f.title}
File: ${f.file}${f.line ? ':' + f.line : ''}
Severity claimed: ${f.severity}
Evidence: ${f.description}
Suggested fix: ${f.suggestion || '(none)'}

Try to REFUTE it. Read the cited file(s) and their consumers yourself. Refute (real=false) if any of these hold:
- The claim misreads the code, or the cited code does not exist as described.
- It is theoretical OO purism with no practical maintenance cost in this idiomatic functional TypeScript codebase (e.g. flagging a single exhaustive switch as OCP).
- The "violation" is a deliberate, documented trade-off (check nearby ADRs in docs/adr/, comments, module READMEs).
- The suggested fix would add indirection with no consumer that benefits (this repo's rule: domain code is pulled by a consumer need, never speculative).
Confirm (real=true) only if the violation is real AND fixing it has a plausible payoff. If real, set the adjusted severity. Be strict: when in doubt, refute.`

phase('Find')
const results = await pipeline(
  PRINCIPLES,
  (p) => agent(findPrompt(p), { label: `find:${p.key}`, phase: 'Find', schema: FINDINGS_SCHEMA }),
  (res, p) => {
    if (!res || !res.findings.length) {
      log(`${p.key}: aucun constat`)
      return []
    }
    log(`${p.key}: ${res.findings.length} constat(s), vérification...`)
    return parallel(
      res.findings.map((f) => () =>
        agent(verifyPrompt(f), { label: `verify:${p.key}:${f.file.split('/').pop()}`, phase: 'Verify', schema: VERDICT_SCHEMA })
          .then((v) => ({ ...f, verdict: v }))
      )
    )
  }
)

const all = results.filter(Boolean).flat().filter(Boolean)
const confirmed = all.filter((f) => f.verdict && f.verdict.real)
const refuted = all.filter((f) => f.verdict && !f.verdict.real)
log(`${confirmed.length} constat(s) confirmé(s), ${refuted.length} réfuté(s)`)
return { confirmed, refuted }