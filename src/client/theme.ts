/**
 * Turn an extracted palette into a `{ tokenName: { light, dark } }` override
 * layer for `ctx.theme.overrideTokens`. The image hue drives every alias token
 * (background surfaces, labels, brand, borders, buttons, code blocks, the
 * sidebar) so text and chrome adapt to the picture, while `--dsh-skin-bg-*`
 * carry the background image URL, its fit and a readability scrim (consumed by
 * the CSS this plugin injects).
 */
import { hsl, hsla, rgbToHsl, hslToRgb, luminance, contrastRatio, type RGB } from './color.ts'
import type { SkinPalette } from './extract.ts'
import type { SkinTokenModes } from '../context-types.ts'
import type { SkinFit } from './store.ts'

/** Token names this skin overrides. */
const OVERRIDES = {
  bgBase: '--dsw-alias-bg-base',
  bgLayer1: '--dsw-alias-bg-layer-1',
  bgLayer2: '--dsw-alias-bg-layer-2',
  bgLayer3: '--dsw-alias-bg-layer-3',
  bgOverlay: '--dsw-alias-bg-overlay',
  sidebarFill: '--dsw-specific-sidebar-fill',
  sidebarNavHover: '--dsw-specific-sidebar-nav-item-hover',
  sidebarNavActive: '--dsw-specific-sidebar-nav-item-active',
  sidebarNavActiveAccent: '--dsw-specific-sidebar-nav-item-active-accent',
  labelPrimary: '--dsw-alias-label-primary',
  labelSecondary: '--dsw-alias-label-secondary',
  labelTertiary: '--dsw-alias-label-tertiary',
  labelCaption: '--dsw-alias-label-caption',
  brandPrimary: '--dsw-alias-brand-primary',
  brandText: '--dsw-alias-brand-text',
  borderL1: '--dsw-alias-border-l1',
  borderL2: '--dsw-alias-border-l2',
  borderL3: '--dsw-alias-border-l3',
  toastBg: '--dsw-alias-toast-bg',
  tooltipBg: '--dsw-alias-tooltip-bg',
  buttonElevatedFill: '--dsw-alias-button-elevated-fill',
  buttonFloatingFill: '--dsw-alias-button-floating-fill',
  buttonFloatingHover: '--dsw-alias-button-floating-hover',
  interactiveHover: '--dsw-alias-interactive-bg-hover',
  interactiveActive: '--dsw-alias-interactive-bg-active',
  markdownCodeBlock: '--dsw-alias-markdown-code-block',
  markdownInlineCode: '--dsw-alias-markdown-inline-code',
  markdownCodeBanner: '--dsw-alias-markdown-code-block-banner',
} as const

/** Custom tokens consumed by this plugin's injected CSS. */
export const IMAGE_TOKEN = '--dsh-skin-bg-image'
export const SIZE_TOKEN = '--dsh-skin-bg-size'
export const SCRIM_TOKEN = '--dsh-skin-scrim'

export interface SkinThemeOptions {
  opacity: number
  fit: SkinFit
  scrim: number
}

function accentHsl(dominant: RGB): [number, number, number] {
  const [h, s, l] = rgbToHsl(...dominant)
  // Keep the accent saturated and legible regardless of the source image.
  return [h, Math.max(s, 45), Math.min(70, Math.max(40, l))]
}

/**
 * Nudge a text color's lightness away from its surface until the WCAG contrast
 * ratio meets `min` (hue and saturation are preserved). Bounded so the result
 * never runs to pure black/white unless the source lightness was already there.
 */
function ensureContrast(fg: [number, number, number], bg: RGB, min: number): [number, number, number] {
  const [h, s] = fg
  let l = fg[2]
  const bgLum = luminance(...bg)
  const dir = luminance(...hslToRgb(h, s, l)) >= bgLum ? 1 : -1
  for (let i = 0; i < 60; i++) {
    if (contrastRatio(hslToRgb(h, s, l), bg) >= min) break
    l = Math.min(100, Math.max(0, l + dir * 0.5))
  }
  return [h, s, l]
}

/**
 * @param palette - extracted image palette.
 * @param imageUrl - the (downscaled) data URL used as the background.
 * @param opts    - opacity, background fit, and scrim strength.
 */
export function buildTokens(
  palette: SkinPalette,
  imageUrl: string,
  opts: SkinThemeOptions,
): Record<string, SkinTokenModes> {
  const alpha = Math.min(1, Math.max(0.3, opts.opacity))
  // Layers (menus/popovers/dialogs/sidebar) follow the slider only SLIGHTLY:
  // they stay ≥ 0.8 opaque even at the most transparent setting, so their text
  // never overlaps the page behind them while still easing with the surface.
  const layerAlpha = Math.min(1, Math.max(0.8, 1 - (1 - alpha) * 0.3))
  const scrimAlpha = Math.min(0.6, Math.max(0, opts.scrim))
  const [avgH, avgS] = rgbToHsl(...palette.average)
  const hue = avgH
  // Cap the background tint's saturation so the surface never goes neon.
  const sat = Math.min(avgS, 45)
  const [accH, accS, accL] = accentHsl(palette.dominant)

  // Opaque reference surfaces for contrast math. (Alpha is ignored — the image
  // behind a translucent surface could be anything, so err toward more contrast.)
  const bgLightRgb = hslToRgb(hue, sat * 0.5, 97)
  const bgDarkRgb = hslToRgb(hue, sat * 0.9, 11)

  // Toast/tooltip stay dark in both modes (mirrors the shipped design), but
  // tinted by the image hue so they still belong to the picture.
  const toast = hsl(hue, sat * 0.5, 22)
  const tooltip = hsl(hue, sat * 0.5, 20)

  const light: Record<string, string> = {
    // The base (frame) surface is fully translucent so the image shows through.
    [OVERRIDES.bgBase]: hsla(hue, sat * 0.5, 97, alpha),
    [OVERRIDES.bgLayer1]: hsla(hue, sat * 0.4, 98, layerAlpha),
    [OVERRIDES.bgLayer2]: hsla(hue, sat * 0.5, 94, layerAlpha),
    [OVERRIDES.bgLayer3]: hsla(hue, sat * 0.5, 90, layerAlpha),
    [OVERRIDES.bgOverlay]: hsl(hue, sat * 0.4, 93),
    [OVERRIDES.sidebarFill]: hsla(hue, sat * 0.35, 96, layerAlpha),
    [OVERRIDES.sidebarNavHover]: hsl(hue, sat * 0.4, 92),
    [OVERRIDES.sidebarNavActive]: hsl(hue, sat * 0.4, 87),
    [OVERRIDES.sidebarNavActiveAccent]: hsl(accH, accS, 45),
    [OVERRIDES.labelPrimary]: hsl(...ensureContrast([hue, sat * 0.8, 16], bgLightRgb, 4.5)),
    [OVERRIDES.labelSecondary]: hsl(...ensureContrast([hue, sat * 0.5, 40], bgLightRgb, 4.5)),
    [OVERRIDES.labelTertiary]: hsl(...ensureContrast([hue, sat * 0.4, 52], bgLightRgb, 3.0)),
    [OVERRIDES.labelCaption]: hsl(...ensureContrast([hue, sat * 0.35, 58], bgLightRgb, 3.0)),
    [OVERRIDES.brandPrimary]: hsl(accH, accS, 45),
    [OVERRIDES.brandText]: hsl(...ensureContrast([hue, sat * 0.8, 16], bgLightRgb, 4.5)),
    [OVERRIDES.borderL1]: hsla(hue, sat * 0.3, 20, 0.08),
    [OVERRIDES.borderL2]: hsla(hue, sat * 0.3, 20, 0.14),
    [OVERRIDES.borderL3]: hsla(hue, sat * 0.3, 20, 0.2),
    [OVERRIDES.toastBg]: toast,
    [OVERRIDES.tooltipBg]: tooltip,
    [OVERRIDES.buttonElevatedFill]: hsl(hue, sat * 0.3, 99),
    [OVERRIDES.buttonFloatingFill]: hsl(hue, sat * 0.3, 99),
    [OVERRIDES.buttonFloatingHover]: hsl(hue, sat * 0.3, 95),
    [OVERRIDES.interactiveHover]: hsla(hue, sat * 0.4, 30, 0.08),
    [OVERRIDES.interactiveActive]: hsla(hue, sat * 0.4, 30, 0.12),
    [OVERRIDES.markdownCodeBlock]: hsl(hue, sat * 0.2, 97),
    [OVERRIDES.markdownInlineCode]: hsl(hue, sat * 0.25, 94),
    [OVERRIDES.markdownCodeBanner]: hsl(hue, sat * 0.2, 97),
  }

  const dark: Record<string, string> = {
    [OVERRIDES.bgBase]: hsla(hue, sat * 0.9, 11, alpha),
    [OVERRIDES.bgLayer1]: hsla(hue, sat * 0.8, 13, layerAlpha),
    [OVERRIDES.bgLayer2]: hsla(hue, sat * 0.8, 16, layerAlpha),
    [OVERRIDES.bgLayer3]: hsla(hue, sat * 0.8, 19, layerAlpha),
    [OVERRIDES.bgOverlay]: hsl(hue, sat * 0.7, 16),
    [OVERRIDES.sidebarFill]: hsla(hue, sat * 0.8, 12, layerAlpha),
    [OVERRIDES.sidebarNavHover]: hsl(hue, sat * 0.7, 18),
    [OVERRIDES.sidebarNavActive]: hsl(hue, sat * 0.7, 22),
    [OVERRIDES.sidebarNavActiveAccent]: hsl(accH, accS, Math.max(accL, 60)),
    [OVERRIDES.labelPrimary]: hsl(...ensureContrast([hue, sat * 0.4, 94], bgDarkRgb, 4.5)),
    [OVERRIDES.labelSecondary]: hsl(...ensureContrast([hue, sat * 0.25, 72], bgDarkRgb, 4.5)),
    [OVERRIDES.labelTertiary]: hsl(...ensureContrast([hue, sat * 0.2, 58], bgDarkRgb, 3.0)),
    [OVERRIDES.labelCaption]: hsl(...ensureContrast([hue, sat * 0.2, 52], bgDarkRgb, 3.0)),
    [OVERRIDES.brandPrimary]: hsl(accH, accS, Math.max(accL, 60)),
    [OVERRIDES.brandText]: hsl(...ensureContrast([hue, sat * 0.4, 94], bgDarkRgb, 4.5)),
    [OVERRIDES.borderL1]: hsla(hue, sat * 0.3, 100, 0.08),
    [OVERRIDES.borderL2]: hsla(hue, sat * 0.3, 100, 0.14),
    [OVERRIDES.borderL3]: hsla(hue, sat * 0.3, 100, 0.2),
    [OVERRIDES.toastBg]: toast,
    [OVERRIDES.tooltipBg]: tooltip,
    [OVERRIDES.buttonElevatedFill]: hsl(hue, sat * 0.6, 18),
    [OVERRIDES.buttonFloatingFill]: hsl(hue, sat * 0.6, 15),
    [OVERRIDES.buttonFloatingHover]: hsl(hue, sat * 0.6, 17),
    [OVERRIDES.interactiveHover]: hsla(hue, sat * 0.2, 100, 0.1),
    [OVERRIDES.interactiveActive]: hsla(hue, sat * 0.2, 100, 0.16),
    [OVERRIDES.markdownCodeBlock]: hsl(hue, sat * 0.5, 9),
    [OVERRIDES.markdownInlineCode]: hsl(hue, sat * 0.5, 14),
    [OVERRIDES.markdownCodeBanner]: hsl(hue, sat * 0.5, 14),
  }

  const tokens: Record<string, SkinTokenModes> = {}
  for (const name of Object.keys(light)) {
    tokens[name] = { light: light[name], dark: dark[name] }
  }

  const size = opts.fit === 'stretch' ? '100% 100%' : opts.fit
  const image = `url("${imageUrl}")`
  tokens[IMAGE_TOKEN] = { light: image, dark: image }
  tokens[SIZE_TOKEN] = { light: size, dark: size }
  // Light mode veils the image white, dark mode veils it black — a subtle,
  // hue-tinted scrim that keeps busy images readable.
  tokens[SCRIM_TOKEN] = {
    light: hsla(hue, sat * 0.3, 100, scrimAlpha),
    dark: hsla(hue, sat * 0.3, 0, scrimAlpha),
  }
  return tokens
}
