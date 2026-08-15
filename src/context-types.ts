/**
 * Structural mirror of the client services this plugin consumes, plus the
 * `@deepseek-ai/cordis` Context augmentation shared by both halves.
 *
 * A third-party plugin resolves outside the DSH monorepo's single cordis
 * instance, so the upstream `declare module 'cordis'` augmentations do not
 * reach this Context. We therefore restate only the members we touch — the
 * same approach `dsh-better-sidebar` takes. `effect`, `on`, `emit`, `get`,
 * `provide`, and `inject` are already part of the vendored
 * `@deepseek-ai/cordis` Context, so they are not re-declared here.
 */
import type { Context } from '@deepseek-ai/cordis'

/** One theme token override: both palette modes are mandatory. */
export type SkinTokenModes = { light: string; dark: string }

/** A selectable theme as `ctx.theme.register` accepts it. */
export interface SkinThemeDefinition {
  id: string
  colorScheme: 'light' | 'dark'
  tokens: Record<string, string>
}

/**
 * The browser theme registry face (`@deepseek-ai/dsh-client-ui-theme`).
 * `overrideTokens` stacks a partial token layer over the ACTIVE theme without
 * registering a selectable theme; `register`/`setTheme`/`getTheme` support the
 * optional "follow the image's brightness" auto light/dark switch.
 */
export interface SkinThemeService {
  /**
   * Stack a token layer. Later calls with the same `source` replace that
   * layer's whole value set. Returns a disposer removing exactly this layer.
   */
  overrideTokens(source: string, tokens: Record<string, SkinTokenModes>): () => void
  /** Register a theme (duplicate id throws); returns the disposer. */
  register(definition: SkinThemeDefinition): () => void
  /** Switch the active theme preference to a registered id, or `system`. */
  setTheme(id: string): void
  /** Read the current immutable theme snapshot. */
  getTheme(): { preference: string; active: { colorScheme: 'light' | 'dark' } }
}

/** Registration options for `ctx.slots.register` (the subset we use). */
export interface SkinSlotRegisterOptions {
  name: string
  id?: string
  order?: number
  label?: string | (() => string)
  key?: string
}

/** The client slots registry face (mirror of `@deepseek-ai/dsh-client-runtime`). */
export interface SkinSlotsService {
  /** Contribute one component to a declared slot; returns the disposer. */
  register(options: SkinSlotRegisterOptions, component: unknown): () => void
  /** Run `callback` for each declaration lifetime of `key`; returns the disposer. */
  inject(key: string, callback: () => () => void): () => void
}

/** The client locale service face (mirror of `@deepseek-ai/dsh-client-locale`). */
export interface SkinLocaleService {
  getSnapshot(): { active: string }
  subscribe(fn: () => void): () => void
  register(ns: string, locale: string, dict: Record<string, string>): () => void
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    theme: SkinThemeService
    slots: SkinSlotsService
    locale: SkinLocaleService
  }
}

export type { Context }
