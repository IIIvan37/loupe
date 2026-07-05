import { clamp01 } from './clamp01.ts'

/**
 * The pointer's position along a horizontal surface as a 0–1 ratio, or null
 * when the surface is unmeasurable (not mounted, or zero width). Shared by the
 * waveform and the marker rail, which both map a `clientX` onto their width.
 */
export function pointerRatio(
  rect: Pick<DOMRect, 'left' | 'width'> | null | undefined,
  clientX: number
): number | null {
  if (!rect || rect.width <= 0) {
    return null
  }
  return clamp01((clientX - rect.left) / rect.width)
}
