import { describe, expect, it } from 'vitest'
import { reportIssueUrl } from './report-issue-url.ts'

describe('reportIssueUrl', () => {
  it('targets the public repo new-issue form', () => {
    expect(reportIssueUrl(undefined)).toMatch(
      /^https:\/\/github\.com\/IIIvan37\/loupe\/issues\/new\?/
    )
  })

  it('pre-fills the version line when the shell knows it', () => {
    expect(reportIssueUrl('0.1.0')).toContain(encodeURIComponent('loupe 0.1.0'))
  })

  it('asks for `loupe --version` when the version is unknown', () => {
    expect(reportIssueUrl(undefined)).toContain(
      encodeURIComponent('loupe --version')
    )
  })
})
