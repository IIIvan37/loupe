/** Where a beta tester reports a bug (AR.2): the public repo's new-issue form.
 * The body pre-fills the version line so the report stays diagnosable even
 * when the tester writes nothing else; French hardcoded like the beta-access
 * mailto — this text lands on GitHub, not in the app's Lingui surface. */
const NEW_ISSUE_URL = 'https://github.com/IIIvan37/loupe/issues/new'

export function reportIssueUrl(version: string | undefined): string {
  const versionLine =
    version === undefined
      ? '**Version** (sortie de `loupe --version`) : '
      : `**Version** : loupe ${version}`
  const body = [
    versionLine,
    '**OS** : ',
    '',
    '**Le problème** (et ce qui était en cours : import, analyse, lecture…) :',
    ''
  ].join('\n')
  return `${NEW_ISSUE_URL}?body=${encodeURIComponent(body)}`
}
