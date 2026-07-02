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
