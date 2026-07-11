// jsdom has no canvas backend: every `getContext()` call logs a noisy
// "Not implemented: HTMLCanvasElement's getContext()" error to the test output.
// jsdom already returns null from it, and the components handle that — so stub
// the method to return null WITHOUT the console noise. Node-environment specs
// have no HTMLCanvasElement and are untouched.
const canvasElement = (
  globalThis as { HTMLCanvasElement?: { prototype: { getContext: unknown } } }
).HTMLCanvasElement

if (canvasElement) {
  canvasElement.prototype.getContext = () => null
}

// jsdom implements no scrolling: Element.prototype.scrollIntoView is missing
// entirely, so any component following the playhead would throw. Stub it as a
// no-op; specs that assert the follow behaviour install their own spy.
const element = (
  globalThis as { Element?: { prototype: { scrollIntoView: unknown } } }
).Element

if (element && typeof element.prototype.scrollIntoView !== 'function') {
  element.prototype.scrollIntoView = () => {}
}
