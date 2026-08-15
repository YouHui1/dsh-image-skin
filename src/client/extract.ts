/**
 * Browser-only image handling: read a File into a downscaled JPEG data URL
 * (so localStorage stays small and the background is fast to paint), then
 * extract a palette — average color, dominant color, and overall luminance —
 * by sampling a tiny canvas.
 */
import { luminance, type RGB } from './color.ts'

export interface SkinPalette {
  /** Mean color of non-transparent pixels. */
  average: RGB
  /** Most frequent quantized color (used as the brand/accent). */
  dominant: RGB
  /** WCAG relative luminance of the average color (0-1). */
  luminance: number
}

const MAX_DIM = 1600
const JPEG_QUALITY = 0.85
const SAMPLE_DIM = 48

/** Read a File and downscale it into a JPEG data URL. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('unsupported image'))
      img.onload = () => resolve(downscale(img))
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

/** Load a data URL into an `HTMLImageElement`. */
export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onerror = () => reject(new Error('unsupported image'))
    img.onload = () => resolve(img)
    img.src = dataUrl
  })
}

/** Extract a palette from an already-downscaled data URL. */
export async function extractPalette(dataUrl: string): Promise<SkinPalette> {
  const img = await loadImage(dataUrl)
  const { data, width, height } = drawToCanvas(img, SAMPLE_DIM)

  const buckets = new Map<string, { count: number; rgb: RGB }>()
  let rSum = 0
  let gSum = 0
  let bSum = 0
  let n = 0

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a < 32) continue // skip transparent pixels
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    rSum += r
    gSum += g
    bSum += b
    n++

    // Quantize to 4-bit buckets for dominant-color voting.
    const key = `${r >> 4},${g >> 4},${b >> 4}`
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.count++
      bucket.rgb[0] += r
      bucket.rgb[1] += g
      bucket.rgb[2] += b
    } else {
      buckets.set(key, { count: 1, rgb: [r, g, b] })
    }
  }

  if (n === 0) {
    // Fully transparent image: fall back to a neutral gray.
    return { average: [128, 128, 128], dominant: [128, 128, 128], luminance: 0.216 }
  }

  const average: RGB = [rSum / n, gSum / n, bSum / n]

  let best: { count: number; rgb: RGB } | null = null
  for (const bucket of buckets.values()) {
    if (best === null || bucket.count > best.count) best = bucket
  }
  const dominant: RGB = [
    best!.rgb[0] / best!.count,
    best!.rgb[1] / best!.count,
    best!.rgb[2] / best!.count,
  ]

  return { average, dominant, luminance: luminance(average[0], average[1], average[2]) }
}

function downscale(img: HTMLImageElement): string {
  const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

function drawToCanvas(img: HTMLImageElement, maxDim: number): { data: Uint8ClampedArray; width: number; height: number } {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas unavailable')
  ctx.drawImage(img, 0, 0, w, h)
  return { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h }
}
