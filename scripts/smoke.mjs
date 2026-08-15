// Smoke test for dsh-image-skin.
//
// Verifies, without a browser:
//   1. the host bundle (`lib/index.js`) is a valid ESM cordis plugin;
//   2. the client bundle (`lib/client.js`) uses the `window.__ModuleLoader__`
//      contract, externalizes react / react/jsx-runtime (does not bundle them
//      or any @deepseek-ai/* package), and its factory returns the expected
//      `inject` + `apply` exports.
//
// Run after `pnpm build`:  node scripts/smoke.mjs
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const root = new URL('../', import.meta.url)

// ── 1. host bundle ─────────────────────────────────────────────────────────
const host = await import(new URL('lib/index.js', root))
assert.equal(host.name, 'dsh-image-skin', 'host name')
assert.ok(Array.isArray(host.inject), 'host inject is an array')
assert.equal(typeof host.apply, 'function', 'host apply is a function')
host.apply({}) // no-op host must not throw

// ── 2. client bundle ───────────────────────────────────────────────────────
const code = readFileSync(new URL('lib/client.js', root), 'utf8')
assert.ok(code.startsWith('window.__ModuleLoader__.load('), 'client wrapper present')
assert.ok(code.includes('require("react")'), 'react is externalized, not bundled')
assert.ok(code.includes('require("react/jsx-runtime")'), 'jsx-runtime is externalized')
assert.ok(!code.includes('@deepseek-ai/dsh-client'), 'no dsh client package is bundled in')

// Evaluate the bundle with a stubbed module-loader sink, then materialize the
// factory against stub runtime modules and inspect its exports.
let handoff = null
const fakeWindow = { __ModuleLoader__: { load: (h) => { handoff = h } } }
new Function('window', code)(fakeWindow)
assert.ok(handoff, 'bundle registered a handoff')
assert.equal(handoff.id, 'dsh-image-skin', 'handoff id')

const stubRequire = (spec) => {
  if (spec === 'react') return { createElement: () => null }
  if (spec === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null, Fragment: null }
  throw new Error(`unexpected require(${JSON.stringify(spec)})`)
}
const exports = handoff.factory(stubRequire)
assert.ok(Array.isArray(exports.inject), 'client inject is an array')
for (const dep of ['slots', 'theme', 'locale']) {
  assert.ok(exports.inject.includes(dep), `client injects "${dep}"`)
}
assert.equal(typeof exports.apply, 'function', 'client apply is a function')

console.log('smoke OK: host + client bundle shape verified')
