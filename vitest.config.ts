import { defineConfig } from 'vitest/config'

/**
 * Vitest 配置。测试运行在 node 环境（纯函数与配置断言均不依赖 DOM）。
 * @bdd EF-NAME-002 纯函数从组件中抽离到工具层（保证可独立单测）
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
})
