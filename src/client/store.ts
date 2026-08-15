/**
 * localStorage persistence for the skin. The image is stored as a downscaled
 * JPEG data URL (kept small by `extract.ts`), so the ~5MB quota is plenty.
 * The palette is recomputed from the image on every load — only the source of
 * truth (image + display options) is persisted.
 */

export type SkinFit = 'cover' | 'contain' | 'stretch'

export interface SkinState {
  /** Downscaled JPEG data URL. */
  image: string
  /** Main surface opacity, 0.3..1. */
  opacity: number
  /** How the image fills the viewport. */
  fit: SkinFit
  /** Readability scrim strength, 0..0.6. */
  scrim: number
  /** Follow the image's brightness: bright → light theme, dark → dark theme. */
  auto: boolean
}

const KEY = 'dsh-image-skin.v1'

export function loadState(): SkinState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<SkinState>
    if (typeof p.image !== 'string' || !p.image.startsWith('data:image/')) return null
    return {
      image: p.image,
      opacity: clamp(typeof p.opacity === 'number' ? p.opacity : 0.9, 0.3, 1),
      fit: p.fit === 'contain' || p.fit === 'stretch' ? p.fit : 'cover',
      scrim: clamp(typeof p.scrim === 'number' ? p.scrim : 0, 0, 0.6),
      auto: p.auto === true,
    }
  } catch {
    return null
  }
}

export function saveState(state: SkinState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Quota exceeded or storage disabled: the skin still applies for this
    // session, it just will not survive a refresh.
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}
