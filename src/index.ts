/**
 * dsh-image-skin host half: a no-op mount point.
 *
 * The entire feature is client-side (background image + palette-derived theme
 * tokens + a settings section), so the Node half provides nothing and depends
 * on nothing. The row in `cordis.patch.yml` still needs this module to resolve
 * and mount; the web shell discovers the browser half through the package's
 * `dsh.client` declaration.
 */
import type { Context } from './context-types.ts'

export { type Context } from './context-types.ts'

/** Plugin identity for cordis.yml rows. */
export const name = 'dsh-image-skin'

/** No host services required. */
export const inject: string[] = []

/** Host plugin body: nothing to do. */
export function apply(_ctx: Context): void {}
