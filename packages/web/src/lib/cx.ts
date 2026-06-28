/**
 * Join class names into a single string, dropping falsy values. Also narrows
 * CSS-module member access (typed `string | undefined` under
 * noUncheckedIndexedAccess) back to a plain `string` for stricter className APIs.
 */
export function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
