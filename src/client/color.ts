/**
 * Small dependency-free color math used to derive the skin palette. All
 * functions are pure; hues are 0-360, saturations/lightnesses 0-100, RGB
 * channels 0-255.
 */

export type RGB = [number, number, number]

/** RGB (0-255) → HSL (h 0-360, s 0-100, l 0-100). */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h * 60, s * 100, l * 100]
}

/** HSL (h 0-360, s 0-100, l 0-100) → RGB (0-255). */
export function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360
  s /= 100
  l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

/** WCAG relative luminance of an RGB triplet (0-1). */
export function luminance(r: number, g: number, b: number): number {
  const f = (c: number): number => {
    c /= 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** WCAG contrast ratio between two RGB triplets (1..21). */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a[0], a[1], a[2])
  const lb = luminance(b[0], b[1], b[2])
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

/** `hsl(h, s%, l%)` legacy syntax (universally supported). */
export function hsl(h: number, s: number, l: number): string {
  return `hsl(${round(h)}, ${round(s)}%, ${round(l)}%)`
}

/** `hsla(h, s%, l%, a)` legacy syntax. */
export function hsla(h: number, s: number, l: number, a: number): string {
  return `hsla(${round(h)}, ${round(s)}%, ${round(l)}%, ${clamp01(a)})`
}

/** `rgba(r, g, b, a)`. */
export function rgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${clamp01(a)})`
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}
