# 队列全屏阅读器 · 功能说明与验证报告

> 本次任务目标：为每个任务队列新增「全屏 Markdown 阅读器」，支持富文本渲染、四档护眼主题、字号调节与各队列独立的阅读进度记忆（EF-READER-*）。

## 一、验证结论（自测通过）

| 校验项 | 结果 |
|---|---|
| `npm test` | ✅ 4 个测试文件 / **30 项全部通过**（含 renderMarkdown 3 项） |
| `npm run build` | ✅ 构建成功（`vue-tsc -b && vite build`，20 modules） |

## 二、更改清单（阅读器功能）

### 1. 依赖：`marked` + `dompurify`（+ `jsdom` 测试用）
- **为什么**：`marked` 负责 Markdown→HTML，`dompurify` 对结果做 XSS 清洗（因通过 `v-html` 注入）。
- **好处**：安全渲染富文本；`jsdom` 仅测试期为 renderMarkdown 提供 DOM 环境。

### 2. `src/types.ts` — `TaskQueue` 新增 `rawContent`
- **改动**：保存导入时的原始 Markdown 全文。
- **好处**：阅读器可回显用户原始文档，而非仅解析后的任务列表。

### 3. `src/utils/markdownParser.ts` — 保留原文
- **改动**：解析时将完整 md 文本写入 `queue.rawContent`。

### 4. `src/utils/renderMarkdown.ts`（新增）
- **改动**：`marked.parse` + `DOMPurify.sanitize`（禁用 script/style/iframe 等危险标签）。
- **好处**：集中、可单测的安全渲染工具（EF-READER-001~003）。

### 5. `src/components/ReaderOverlay.vue`（新增）
- **改动**：全屏阅读器，含富文本渲染、四档护眼主题（纸白/护眼绿/羊皮纸/夜间）、字号 A-/A+、各队列独立滚动进度记忆、偏好持久化、Esc 关闭。

### 6. `src/App.vue` — 队列头部「预览原文」按钮
- **改动**：挂载阅读器并传入对应队列 `rawContent`。

### 7. `src/reader.css`（新增）+ `src/main.ts` 引入
- **改动**：阅读器主题变量与富文本排版样式。

### 8. `src/utils/__tests__/renderMarkdown.spec.ts`（新增）
- **改动**：顶部 `// @vitest-environment jsdom` 单独切 jsdom 环境（其余测试仍为 node），覆盖标题/列表/加粗/链接渲染与空输入。

---

# （历史）工程化收尾 · 更改清单与验证报告


> 本次任务目标：修复启动/构建阻断问题，落地 BDD 工程化规范（EF-CSS-*, EF-BUILD-*, EF-CACHE-*），并完成性能优化与自测。

## 一、验证结论（自测通过）

| 校验项 | 结果 |
|---|---|
| `npm test` | ✅ 3 个测试文件 / **27 项全部通过** |
| `npm run build` | ✅ 构建成功（`vue-tsc -b && vite build`） |
| `npm run preview` | ✅ 首页 + JS / CSS / vendor 资源全部返回 **HTTP 200** |
| 生产 sourcemap | ✅ 无 `.map` 文件、产物内无 sourcemap（防源码泄漏） |
| 队列类型配色（`.type-*`） | ✅ 产物 CSS 中 `--type-bg` 定义 **5 次**，5 个配色类全部保留 |
| Vue 分包 | ✅ 独立 `vendor-vue`（71.79 kB / gzip 28.5 kB） |
| 内容哈希 | ✅ `index.[hash].js/css`、`vendor-vue.[hash].js` |

---

## 二、更改清单（改了什么 / 为什么 / 好处）

### 1. `src/App.vue` — 修复致命引用错误
- **改动**：`import ... from './components/Icon.vue'` → `'./components/BaseIcon.vue'`
- **为什么**：项目里只有 `BaseIcon.vue`，原引用指向不存在的文件，dev 启动与生产构建都会直接报错。
- **好处**：修复应用无法启动的致命 bug（阻断级）。

### 2. `src/styles.css` — Tailwind 指令入口（EF-CSS-001）
- **改动**：文件顶部加入
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  ```
- **为什么**：原文件没有 Tailwind 入口指令，所有原子类（`text-sage`、`bg-orange` 等）根本不会被生成。
- **好处**：Tailwind 原子类正式生效，满足 EF-CSS-001。

### 3. `src/styles.css` — 类型色归入组件层（EF-CSS-003）
- **改动**：`.type-学习/工作/生活/运动/其他` 用 `@layer components { … }` 包裹。
- **为什么**：这些是语义组件类，放进 components 层可获得可控、稳定的层级优先级（低于 utilities，便于原子类覆盖）。
- **好处**：满足 EF-CSS-003，避免样式优先级混乱。

### 4. `vite.config.ts` — 生产关闭 sourcemap（EF-BUILD-003）
- **改动**：引入 `const isProduction = mode === 'production'`，`sourcemap: isProduction ? false : true`，并补 JSDoc `@bdd` 注释。
- **为什么**：生产环境暴露 sourcemap 会泄漏源码；开发环境保留便于调试。
- **好处**：满足 EF-BUILD-003，减小产物体积、防源码泄漏。

### 5. `tsconfig.app.json` — 应用构建配置修复
- **改动**：加 `"composite": true`；`types` 从 `["vite/client","vitest/globals","node"]` 精简为 `["vite/client"]`；新增 `exclude: ["src/**/__tests__/**","src/**/*.spec.ts","src/**/*.test.ts"]`。
- **为什么**：项目引用（project references）要求 composite；应用构建不应把测试文件与 vitest 类型一起编译。
- **好处**：修复 `vue-tsc -b` 拉入 vitest 类型声明导致的构建报错，构建产物纯净。

### 6. `tsconfig.node.json` — 去掉 vitest 配置文件
- **改动**：`include` 从 `["vite.config.ts","vitest.config.ts"]` 改为 `["vite.config.ts"]`。
- **为什么**：`vitest.config.ts` 从 `vitest/config` 导入，会把 vitest 的类型声明拖进类型检查，触发 moduleResolution 报错。
- **好处**：构建期不再报 vitest 相关类型错误（vitest 运行仍由 `vitest.config.ts` 自己驱动，不受影响）。

### 7. `tsconfig.json` — 根配置精简
- **改动**：移除 `compilerOptions.types`（vitest globals）与 `include: ["src/**/*.spec.ts"]`，只保留纯 `references`。
- **为什么**：根 solution 配置职责应是编排子项目引用，不该混入测试类型。
- **好处**：职责清晰，构建链路干净。

### 8. `tailwind.config.js` — safelist 修复动态类名掉色
- **改动**：新增
  ```js
  safelist: ['type-学习', 'type-工作', 'type-生活', 'type-运动', 'type-其他'],
  ```
- **为什么**：App.vue 用 `` :class="`type-${queue.type}`" `` 动态拼接类名，Tailwind 静态扫描无法识别完整类名，生产 purge 会把这 5 个配色类删掉（自测发现产物里 `--type-bg` 定义为 0 次）。
- **好处**：显式白名单保证配色类保留，**修复线上队列图标类型配色掉色**的真实生产 bug（safelist 是官方推荐的动态类名处理方式）。

---

## 三、性能优化（已落地）

1. **第三方依赖分包**（EF-BUILD-001）
   `rollupOptions.output.manualChunks` 将 `vue` 拆到独立 `vendor-vue`（71.79 kB / gzip 28.5 kB），与业务代码（33.46 kB）分离。业务代码更新时，用户浏览器**无需重新下载 Vue 框架**，长期命中缓存。

2. **内容哈希文件名**（EF-BUILD-002 / EF-CACHE-001）
   `entry/chunk/asset` 文件名均带 `[hash]`（如 `index.DDVQw6Tn.js`）。配合 CDN `Cache-Control: immutable` 可对静态资源做**长效强缓存**，内容变化才换名、自动破缓存。

3. **生产关闭 sourcemap**（EF-BUILD-003）
   减小产物体积，避免源码泄漏。

4. **体积概览**
   gzip 后：业务 JS ≈ 13.7 kB、vendor-vue ≈ 28.5 kB、CSS ≈ 8.4 kB，首屏体积可控。

---

## 四、命令速查

```bash
npm test          # 单元测试（27 项）
npm run build     # 生产构建（vue-tsc 类型检查 + vite 打包）
npm run preview   # 本地预览生产产物
```
·