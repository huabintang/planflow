<div align="center">

<img src="docs/assets/preview.svg" alt="PlanFlow 界面预览" width="100%"/>

# PlanFlow

**把 Markdown 计划，变成会流动的任务队列**

[![Vue 3](https://img.shields.io/badge/Vue-3.5-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-30%20passing-16a86b)](./src/utils/__tests__)
[![License](https://img.shields.io/badge/License-MIT-087849)](./LICENSE)

</div>

---

你有没有遇到过这种情况：把一天的计划写在 Markdown 里，却要在密密麻麻的文字里找任务、划掉完成项，最后不知道自己到底做了多少？

PlanFlow 解决的就是这件事。把你的 `.md` 计划文件拖进来，它会自动识别任务、按时间排列、分类展示，让你专注在"做"而不是"找"。

---

## ✨ 功能亮点

### 🗂️ 一文件一队列，互不干扰
每个 Markdown 文件对应一个独立队列。多个计划并排管理，不会混成一张超长清单。

### 📖 全屏 Markdown 阅读器
点击「预览原文」，以沉浸式全屏阅读原始文档。支持四档护眼主题（纸白 / 护眼绿 / 羊皮纸 / 夜间）、字号调节，以及每个队列独立的滚动进度记忆——下次打开自动回到上次读到的位置。

### 🧠 智能解析引擎
解析器只把"明确的任务写法"加入队列，普通说明段落不会被误识别：
- `- [ ]` / `- [x]` 勾选项、普通列表、编号列表
- `08:00`、`08:00-10:00`、`08:00 至 09:30` 等多种时间格式
- `H001`、`H002：基础类型` 等小时课程标题
- 缩进子列表、`说明：`、`内容：`、`重点：` 自动成为任务的具体内容
- Markdown 表格中的时间 + 任务行

### ⏱️ 时间感知
任务时间自动归一化，支持开始时间、时间段、中文时间描述，统一展示在任务卡片上。

### 💡 小时励志语
每个 H001–H024 小时任务都有专属励志语，展开任务时顶部能量横幅同步切换，帮你保持专注节奏。

### 💾 本地优先，隐私零上传
所有数据仅保存在浏览器 `localStorage`，不依赖任何服务器，断网也能用。

### 🎨 薄荷主题 UI
清爽的薄荷绿配色，5 种队列类型（学习 / 工作 / 生活 / 运动 / 其他）各有专属色彩标识。

### 🛡️ 安全富文本渲染
阅读器使用 `marked` 解析 Markdown，`DOMPurify` 清洗 HTML，防止 XSS 注入。

---

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生产构建
npm run build

# 运行单元测试（30 项）
npm test
```

浏览器打开 `http://localhost:5173`，把你的 `.md` 计划文件拖入左侧面板即可。

---

## 📝 Markdown 写法示例

### 日常计划

```markdown
# 周四计划

## 学习 · 08:00-10:00
- [ ] 完成 TypeScript 课程第 5 章 50分钟
  - 先看第 5 章视频前半段
  - 完成课后练习 1-3 题
- [x] 整理昨天的阅读笔记

## 工作 · 10:30-12:00
- [ ] 回复项目邮件
- [ ] 准备下午会议材料 40分钟

## 运动 · 19:30
- [ ] 跑步 5 公里
- [ ] 拉伸 15分钟
```

### H001 小时课程

```markdown
# TypeScript 手把手恢复课

## H001
安装开发环境，完成第一个 TypeScript 项目。
- 安装 Node.js
- 初始化项目

## H002：基础类型
理解 string、number、boolean 等基础类型。

## H003 - 接口与泛型
完成接口与泛型练习。
```

文件名可以包含小时范围，例如 `TypeScript 手把手恢复课：H001–H024.md`，解析器会自动识别。

---

## 🏗️ 技术栈

| 层级 | 技术 |
|---|---|
| 框架 | Vue 3 (Composition API + `<script setup>`) |
| 语言 | TypeScript 5.9 |
| 构建 | Vite 5.4 + vue-tsc |
| 样式 | Tailwind CSS 3.4（薄荷主题设计令牌） |
| 渲染 | marked 18 + DOMPurify 3（安全富文本） |
| 测试 | Vitest 4（30 项单测，node + jsdom 双环境） |
| 持久化 | localStorage（`planflow.file-queues.v2`） |

### 项目结构

```
src/
├── App.vue                    # 主界面（队列管理 + 任务操作）
├── components/
│   ├── BaseIcon.vue           # SVG 图标组件
│   └── ReaderOverlay.vue      # 全屏 Markdown 阅读器
├── utils/
│   ├── markdownParser.ts      # Markdown 解析引擎
│   ├── renderMarkdown.ts      # 安全富文本渲染
│   ├── taskTime.ts            # 时间格式归一化
│   └── __tests__/             # 单元测试（30 项）
├── types.ts                   # TypeScript 类型定义
├── styles.css                 # Tailwind 入口 + 主题样式
└── reader.css                 # 阅读器主题变量
```

---

## 🗺️ Roadmap

- [ ] 键盘快捷键支持
- [ ] 多队列进度汇总视图
- [ ] 任务拖拽排序
- [ ] 导入时自动检测文件编码
- [ ] PWA 离线支持

---

## 📄 License

[MIT](./LICENSE) © 2025 [huabintang](https://github.com/huabintang)
