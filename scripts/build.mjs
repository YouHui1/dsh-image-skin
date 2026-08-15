// Build script for dsh-image-skin.
//
// Produces two artifacts:
//   lib/index.js   — the host half: plain ESM, no wrapper (the profile's
//                    Node loader consumes it as an ordinary module).
//   lib/client.js  — the browser half: a CJS bundle wrapped in
//                    `window.__ModuleLoader__.load({ id, factory })`, which is
//                    the exact contract the web shell's client module system
//                    expects (see @deepseek-ai/dsh-client-modules).
//
// Runtime imports (react, react/jsx-runtime, @deepseek-ai/*) are externalized:
// the web shell provides them at runtime, so they must NOT be bundled in.
import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'

const PACKAGE_ID = 'dsh-image-skin'

// Runtime imports to leave external (the web shell provides these at runtime;
// they must NOT be bundled in). Type-only imports are erased by esbuild, so no
// @deepseek-ai/* entry is needed here.
const externals = ['react', 'react/jsx-runtime', 'react-dom']

mkdirSync('lib', { recursive: true })

// ── host half: ESM ──────────────────────────────────────────────────────────
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['node20'],
  external: externals,
  outfile: 'lib/index.js',
  sourcemap: false,
  logLevel: 'info',
})

// ── client half: CJS, wrapped for the module loader ────────────────────────
const result = await build({
  entryPoints: ['src/client/index.tsx'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  jsx: 'automatic',
  target: ['es2020'],
  external: externals,
  write: false,
  sourcemap: false,
  logLevel: 'info',
})

const body = result.outputFiles[0].text
const wrapped = [
  'window.__ModuleLoader__.load({',
  `  id: ${JSON.stringify(PACKAGE_ID)},`,
  '  factory: (require) => {',
  '    var module = { exports: {} };',
  '    var exports = module.exports;',
  body,
  '    return module.exports;',
  '  },',
  '});',
  '',
].join('\n')

writeFileSync('lib/client.js', wrapped)
console.log(`[dsh-image-skin] wrote lib/client.js (${wrapped.length} bytes)`)
