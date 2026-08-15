/**
 * dsh-image-skin client half.
 *
 * - Injects one static CSS rule that routes `--dsh-skin-bg-image` onto the
 *   page background (the token value itself is applied by the theme presenter
 *   as an inline custom property on `<body>`).
 * - Applies an image palette through `ctx.theme.overrideTokens`, which stacks
 *   light/dark alias-token overrides over the ACTIVE theme — so text, brand,
 *   borders and surfaces all adapt to the picture while respecting the user's
 *   existing light/dark preference.
 * - Registers the "Background skin" settings section.
 * - Persists the image + opacity in localStorage and restores on load.
 */
import { createElement } from 'react'
import type { Context } from '../context-types.ts'
import { buildTokens } from './theme.ts'
import { extractPalette, type SkinPalette } from './extract.ts'
import { clearState, loadState, saveState, type SkinState } from './store.ts'
import { SkinSettings, type SkinController } from './SkinSettings.tsx'

/** Services required before mounting (all provided by the client runtime). */
export const inject = ['slots', 'theme', 'locale']

const SOURCE = 'dsh-image-skin'
const CSS_TAG_ID = 'dsh-image-skin/skin.css'
const AUTO_THEME_ID = 'dsh-image-skin-auto'

// Scrim layer (a uniform gradient over the image) sits on top of the image and
// below the surfaces; its color/size ride tokens so removing the skin retracts
// everything together with the override layer.
const SKIN_CSS =
  'body{background-image:linear-gradient(var(--dsh-skin-scrim,transparent),var(--dsh-skin-scrim,transparent)),var(--dsh-skin-bg-image);background-size:cover,var(--dsh-skin-bg-size,cover);background-position:center;background-repeat:no-repeat;background-attachment:fixed;}'

export function apply(ctx: Context): void {
  // Static CSS (never changes; the token value is what changes).
  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.dataset.plugin = SOURCE
    tag.dataset.pluginCss = CSS_TAG_ID
    tag.textContent = SKIN_CSS
    document.head.appendChild(tag)
    return () => tag.remove()
  }, `${SOURCE}: background css`)

  let disposeOverrides: (() => void) | null = null

  // Auto light/dark bookkeeping: the "auto" theme is a registered scheme carrier
  // (empty tokens — the real colors come from the override layer), so switching
  // it never overwrites the user's durable light/dark/system preference.
  let autoThemeDisposer: (() => void) | null = null
  let autoScheme: 'light' | 'dark' | null = null
  let autoOriginal: string | null = null

  const applyAutoScheme = (scheme: 'light' | 'dark'): void => {
    if (autoThemeDisposer !== null && autoScheme === scheme) return
    autoScheme = scheme
    autoThemeDisposer?.()
    autoThemeDisposer = ctx.theme.register({ id: AUTO_THEME_ID, colorScheme: scheme, tokens: {} })
    if (autoOriginal === null) autoOriginal = ctx.theme.getTheme().preference
    ctx.theme.setTheme(AUTO_THEME_ID)
  }

  const clearAuto = (): void => {
    if (autoThemeDisposer !== null) {
      // Restore the pre-auto preference only if WE are still the active choice
      // (a manual theme switch by the user is left alone).
      if (autoOriginal !== null && ctx.theme.getTheme().preference === AUTO_THEME_ID) {
        ctx.theme.setTheme(autoOriginal)
      }
      autoThemeDisposer()
      autoThemeDisposer = null
    }
    autoOriginal = null
    autoScheme = null
  }

  // In-memory mirror + palette cache. `getState` hands the applied skin back to
  // the settings section so a remount (panel close → reopen) restores the
  // preview and keeps the controls enabled. The palette depends only on the
  // image, so dragging the opacity slider reuses it instead of re-sampling.
  let current: (SkinState & { palette: SkinPalette }) | null = null
  const saved = loadState()

  const controller: SkinController = {
    async apply(state) {
      let palette: SkinPalette
      if (current !== null && current.image === state.image) {
        palette = current.palette
      } else {
        palette = await extractPalette(state.image)
      }
      const tokens = buildTokens(palette, state.image, state)
      disposeOverrides?.()
      disposeOverrides = ctx.theme.overrideTokens(SOURCE, tokens)

      if (state.auto) {
        applyAutoScheme(palette.luminance > 0.5 ? 'light' : 'dark')
      } else {
        clearAuto()
      }

      current = { ...state, palette }
      saveState(state)
    },
    remove() {
      clearAuto()
      disposeOverrides?.()
      disposeOverrides = null
      current = null
      clearState()
    },
    getState() {
      return current === null
        ? null
        : { image: current.image, opacity: current.opacity, fit: current.fit, scrim: current.scrim, auto: current.auto }
    },
  }

  // Restore the persisted skin after activation.
  if (saved) {
    void controller.apply(saved).catch((err: unknown) => {
      console.error('[dsh-image-skin] restore failed:', err)
    })
  }

  // The settings page. `label` is a function so the shell re-reads it and the
  // entry re-renders when the locale changes.
  ctx.slots.inject(
    'settings.section',
    () =>
      ctx.slots.register(
        {
          name: 'settings.section',
          id: 'image-skin',
          order: 200,
          label: () => (ctx.locale.getSnapshot().active === 'zh' ? '皮肤' : 'Skin'),
        },
        (props: { close: () => void }) =>
          createElement(SkinSettings, { close: props.close, controller, locale: ctx.locale }),
      ),
  )

  // Release the override layer and the auto theme on fiber teardown (HMR / stop).
  ctx.effect(
    () => () => {
      clearAuto()
      disposeOverrides?.()
      disposeOverrides = null
    },
    `${SOURCE}: teardown`,
  )
}
