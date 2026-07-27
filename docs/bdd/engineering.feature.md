# Planflow 工程化 BDD 需求文档

> 本文以 BDD（行为驱动开发）方式描述 Planflow 的工程化需求。
> 每个 `Scenario` 都对应 `src/**/__tests__` 下的一条 TDD 测试用例，
> 并以注释 `@bdd EF-xxx` 的形式回注到被测源码，实现「文档 ⇄ 测试 ⇄ 代码」三向可追溯。

编号规则：`EF-<模块>-<序号>`
- `EF-CSS`   —— CSS 工程化 / Tailwind
- `EF-NAME`  —— 组件与命名规范
- `EF-BUILD` —— 打包优化
- `EF-CACHE` —— 缓存优化
- `EF-PARSE` —— 解析器领域逻辑（TDD 主战场）

---

## Feature: CSS 工程化（Tailwind CSS）

作为 一名维护者
我希望 样式统一由 Tailwind 原子类 + 少量语义组件类驱动
以便 降低手写 CSS 的维护成本，并让样式随组件就地可读。

### Scenario: EF-CSS-001 Tailwind 指令入口存在
- Given 项目使用 Tailwind CSS
- When 构建工具处理 `src/styles.css`
- Then 文件顶部应包含 `@tailwind base; @tailwind components; @tailwind utilities;` 三条指令

### Scenario: EF-CSS-002 设计令牌通过主题暴露
- Given 品牌薄荷绿配色需要跨组件复用
- When 读取 `tailwind.config` 的 `theme.extend.colors`
- Then 应存在 `sage` / `orange` / `ink` 等语义色，供 `text-sage`、`bg-orange` 使用

### Scenario: EF-CSS-003 队列类型色作为语义组件类保留
- Given 队列有「学习/工作/生活/运动/其他」五种类型色
- When 渲染 `type-学习` 等类名
- Then 通过 `@layer components` 提供 `--type` / `--type-bg` 变量，避免在模板里散落硬编码色值

---

## Feature: 组件与命名规范

作为 一名协作开发者
我希望 组件与工具函数遵循统一命名规范
以便 阅读与检索代码时具有一致的心智模型。

### Scenario: EF-NAME-001 组件使用多单词 PascalCase 命名
- Given Vue 官方风格指南要求组件名多单词
- When 检查 `src/components` 下的组件文件名
- Then 单文件组件应为多单词 PascalCase（如 `BaseIcon.vue`），避免与 HTML 元素冲突

### Scenario: EF-NAME-002 纯函数从组件中抽离到工具层
- Given 时间解析、励志语选择等逻辑与视图无关
- When 组织代码
- Then 这些纯函数应位于 `src/utils/` 且可被独立 import 和单测

---

## Feature: 打包优化

作为 一名发布者
我希望 产物被合理拆分并生成带哈希的文件名
以便 首屏更快、长效缓存可用。

### Scenario: EF-BUILD-001 第三方依赖单独分包
- Given 应用依赖 Vue 运行时
- When 执行 `vite build`
- Then Vue 应被拆到独立的 `vendor` chunk，与业务代码分离

### Scenario: EF-BUILD-002 产物文件名带内容哈希
- Given 需要长效缓存
- When 生成 `dist/assets`
- Then JS/CSS 文件名应包含内容哈希（如 `app.[hash].js`）

### Scenario: EF-BUILD-003 生产环境移除 sourcemap 泄漏
- Given 生产环境不应暴露源码映射
- When `mode === 'production'`
- Then `build.sourcemap` 应为 false

---

## Feature: 缓存优化

作为 一名终端用户
我希望 再次访问时静态资源命中缓存
以便 页面秒开且离线可用度更高。

### Scenario: EF-CACHE-001 带哈希资源可被强缓存
- Given 资源名包含内容哈希
- When 部署到 CDN / 静态服务器
- Then 这些资源可安全设置 `Cache-Control: max-age=31536000, immutable`

### Scenario: EF-CACHE-002 本地队列数据具备版本化存储键
- Given localStorage 结构可能升级
- When 读写本地数据
- Then 应使用带版本号的存储键（`planflow.file-queues.v2`），旧版本数据不被误加载

---

## Feature: 解析器领域逻辑（TDD 主战场）

作为 一名使用者
我希望 只有「明确的任务写法」进入队列
以便 普通说明段落不会污染任务清单。

### Scenario: EF-PARSE-001 勾选项识别为任务且保留完成状态
- Given 一段包含 `- [ ]` 与 `- [x]` 的 Markdown
- When 调用 `parseMarkdown`
- Then 两项都成为任务，且 `- [x]` 的 `completed` 为 true

### Scenario: EF-PARSE-002 顶级列表是任务、缩进子列表是明细
- Given 一个顶级列表项下有缩进子项
- When 解析
- Then 顶级项是任务，缩进子项进入该任务的 `details`

### Scenario: EF-PARSE-003 普通说明段落被忽略
- Given 既非列表、勾选项也不带时间的纯文本段落
- When 解析
- Then 该段落不产生任务，`ignored` 计数增加

### Scenario: EF-PARSE-004 H001 小时标题生成独立小时任务
- Given 文件包含 `## H001`、`## H002：基础类型`
- When 解析
- Then 生成 `time` 为 `H001`/`H002` 的任务，无名称时以编号作为标题

### Scenario: EF-PARSE-005 时间格式被规范化
- Given 标题含 `08:00-10:00`
- When 解析该区块下的任务
- Then 任务 `time` 归一化为 `08:00`

### Scenario: EF-PARSE-006 单文件任务数量上限保护
- Given 一个包含超过 120 个列表项的文件
- When 解析
- Then 最多保留 120 个任务，且 `truncated` 为 true

### Scenario: EF-PARSE-007 相同时间+标题的任务去重
- Given 两行完全相同的勾选项
- When 解析
- Then 只保留一个任务

### Scenario: EF-PARSE-008 队列类型按关键词推断
- Given 正文包含「跑步」「拉伸」等运动关键词
- When 解析
- Then 队列 `type` 推断为「运动」
