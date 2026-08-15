# AGENTS.md — dsh-image-skin 项目约定

给未来的人类协作者和 AI agent 的速查手册。改动前先读一遍，尤其是「不要做的事」和「构建产物契约」。

## 这是什么

`dsh-image-skin` 是 DeepSeek Harness（DSH）的 **web 客户端插件**：设置一张背景图，并按图片配色自动派生一套主题（背景表面、文字、品牌色、边框、按钮、代码块、侧边栏）。**纯客户端**，host 半是空挂载点，不注册任何 host 服务/路由/工具。

- 依赖的 DSH 版本基线：`@deepseek-ai/dsh-*@0.1.0-rc.6`、`@deepseek-ai/cordis@^4.0.1`、`react@^18`（都是 **peerDependencies**，运行时由 DSH web profile 提供，构建时外部化）。

## 目录结构

```
src/index.ts               # host 半：name/inject/apply 空挂载点
src/context-types.ts       # 结构化的 ctx 类型镜像 + declare module '@deepseek-ai/cordis'
src/client/index.tsx       # client 半：apply()、CSS 注入、overrideTokens、设置分区、自动明暗
src/client/SkinSettings.tsx# 设置 UI（上传/预览/不透明度/填充/遮罩/自动明暗/移除）
src/client/theme.ts        # 调色板 → token 覆盖层（light+dark 两套，含对比度保证）
src/client/extract.ts      # 图片缩小 + 平均色/主色/亮度抽取（canvas）
src/client/color.ts        # 纯色彩数学（RGB/HSL/亮度/对比度）
src/client/store.ts        # localStorage 持久化（SkinState）
cordis.patch.yml           # bundle patch：把插件挂载进 profile
scripts/build.mjs          # esbuild 构建（host ESM + client 模块加载器包壳）
scripts/smoke.mjs          # 冒烟验证（host 导出 + client bundle 契约）
```

## 命令

需要 Node.js **≥ 22.13**（pnpm 11.21 依赖 `node:sqlite` 内建模块）与 pnpm 11。

```sh
pnpm install
pnpm build        # node scripts/build.mjs && tsc -p tsconfig.build.json
pnpm typecheck    # tsc --noEmit
pnpm smoke        # 冒烟验证，无需浏览器
pnpm test         # = pnpm smoke
```

`pnpm-workspace.yaml` 里的 `allowBuilds: { esbuild: true }` 是 **必需的**：pnpm 11 默认拦截依赖 postinstall，esbuild 的安装脚本要靠它放行才能把平台二进制接好。不要删。

## 核心机制（改代码前必读）

插件只走两个官方接缝，**不改 DOM 结构、不硬编码产品选择器**：

1. **`ctx.theme.overrideTokens(source, tokens)`** —— 在「当前主题」之上叠加一层 token 覆盖。形状必须是 `{ '--dsw-alias-xxx': { light, dark } }`（light/dark 都是字符串，缺一个会抛错）。主题呈现器会把 token 以内联 CSS 变量写到 `<body>`，所以整个应用随之换色；返回的 disposer 用于撤销该层。
2. **注入一段静态 CSS** —— 背景图/填充/遮罩通过自定义 token（`--dsh-skin-bg-*`）传给呈现器，CSS 本身不变，只变 token 值，于是皮肤能随 token 层一起撤销。
3. **`ctx.theme.register` + `ctx.theme.setTheme`（自动明暗）** —— 注册一个「空 token 方案载体」主题（`{ id, colorScheme: 'light'|'dark', tokens: {} }`）并设为当前方案。只有内置 `light/dark/system` 会写回 settings，自定义 id 是进程内的，不会覆盖用户持久化偏好；退出自动时恢复进入前的偏好。

## 不变量（别破坏）

- **弹框/菜单/对话框/侧边栏必须保持 ≥80% 不透明**：`theme.ts` 里 `layerAlpha = clamp(1 − (1−alpha)×0.3, 0.8, 1)`，只有 `bg-base` 跟随不透明度滑块。否则叠层文字会和下层重叠（这是踩过的坑）。
- **文字对比度保证**：`ensureContrast()` 对文字 vs 表面做 WCAG 校验，主/次文字 ≥4.5:1、三级/说明 ≥3:1，不足沿明度方向微调（保持色相/饱和度）。
- **peerDeps 不进 bundle**：`scripts/build.mjs` 里 `external = ['react', 'react/jsx-runtime', 'react-dom']`。client 运行时只 `require('react')` / `require('react/jsx-runtime')`；所有 `@deepseek-ai/*` 与 `cordis` 的 import 必须是 **type-only**（会被擦除）。若新增运行时代码 import 了某个包，必须同时加进 `external`。
- **不要有 `export default`**：Loader 的 `unwrapExports` 会把 default 折叠导致 `inject` 丢失（DSH 官方插件一致的约定）。
- **设置页挂载恢复**：`SkinSettings` 用 `controller.getState()` 初始化本地 state（面板关闭会卸载组件，不能只靠 `useState(null)`）。

## 持久化（localStorage）

键 `dsh-image-skin.v1`，存 `SkinState`：

```ts
{ image: string /* data:image/jpeg 缩小图 */, opacity: number /* 0.3..1 */,
  fit: 'cover'|'contain'|'stretch', scrim: number /* 0..0.6 */, auto: boolean }
```

`loadState()` 对旧数据/缺字段补默认值（fit=cover、scrim=0、auto=false）。新增字段时**必须**在 `loadState()` 里给默认值，保持向后兼容。

## 发布（当前不发布）

- 当前 `package.json` 已设 `"private": true`，不发布 npm；个人使用走 `dsh plugin --profile web add link:<绝对路径>` 即可自动挂载。
- 若将来要发 npm：先删掉 `private`，再**改 scoped 名**避免全局抢名，并**绝不要用 `@deepseek-ai` scope**（那是官方组织）。改 `package.json.name`（+ `publishConfig.access: public`）、`cordis.patch.yml` 的 `name`、`scripts/build.mjs` 的 `PACKAGE_ID`、`src/client/index.tsx` 的 `SOURCE` / `AUTO_THEME_ID`，以及 README 里的包名。
- 许可：MIT；非官方隶属，不要在署名上冒充 DeepSeek。

## 构建产物契约（冒烟脚本的校验点）

`scripts/smoke.mjs` 校验的是这两个产物不可破坏：

- `lib/index.js`：ESM，导出 `name`/`inject`/`apply`。
- `lib/client.js`：以 `window.__ModuleLoader__.load({ id, factory: (require) => {...} })` 开头；`react`/`react/jsx-runtime` 用 `require()` 外部化；不打包任何 `@deepseek-ai/dsh-client-*`；工厂返回 `module.exports`（含 `inject`、`apply`）。

改动构建逻辑后务必跑 `pnpm build && pnpm smoke`。
