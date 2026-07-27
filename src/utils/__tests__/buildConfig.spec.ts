import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * TDD 用例：工程化配置断言（CSS / 打包 / 缓存）。
 * 以“读取配置文件文本”的方式做静态校验，把 BDD 需求钉死在配置里。
 */
const root = resolve(__dirname, '../../..')
const read = (relative: string) => readFileSync(resolve(root, relative), 'utf-8')

describe('CSS 工程化（Tailwind）', () => {
  it('EF-CSS-001 styles.css 含 Tailwind 三大指令', () => {
    const css = read('src/styles.css')
    expect(css).toMatch(/@tailwind\s+base/)
    expect(css).toMatch(/@tailwind\s+components/)
    expect(css).toMatch(/@tailwind\s+utilities/)
  })

  it('EF-CSS-002 tailwind 主题暴露品牌语义色', () => {
    const config = read('tailwind.config.js')
    expect(config).toMatch(/sage/)
    expect(config).toMatch(/orange/)
    expect(config).toMatch(/ink/)
  })

  it('EF-CSS-003 队列类型色以 @layer components 提供', () => {
    const css = read('src/styles.css')
    expect(css).toMatch(/@layer\s+components/)
    expect(css).toMatch(/\.type-/)
  })
})

describe('打包优化', () => {
  const config = () => read('vite.config.ts')

  it('EF-BUILD-001 Vue 拆分到独立 vendor chunk', () => {
    expect(config()).toMatch(/manualChunks/)
    expect(config()).toMatch(/vendor/)
  })

  it('EF-BUILD-002 产物文件名带内容哈希', () => {
    expect(config()).toMatch(/\[hash\]/)
  })

  it('EF-BUILD-003 生产环境关闭 sourcemap', () => {
    expect(config()).toMatch(/sourcemap\s*:\s*false/)
  })
})

describe('缓存优化', () => {
  it('EF-CACHE-002 使用带版本号的本地存储键', () => {
    const app = read('src/App.vue')
    expect(app).toMatch(/planflow\.file-queues\.v2/)
  })
})

describe('组件命名规范', () => {
  it('EF-NAME-001 图标组件采用多单词 PascalCase 命名', () => {
    // BaseIcon.vue 满足多单词 PascalCase，避免与 HTML 元素冲突
    expect(() => read('src/components/BaseIcon.vue')).not.toThrow()
  })
})
