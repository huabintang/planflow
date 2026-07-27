import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * Vite 配置。
 *
 * 打包与缓存优化（对应 BDD 场景）：
 * @bdd EF-BUILD-001 第三方依赖单独分包（manualChunks 把 vue 拆到 vendor）
 * @bdd EF-BUILD-002 产物文件名带内容哈希（[hash]）便于长效缓存
 * @bdd EF-BUILD-003 生产环境关闭 sourcemap，避免源码泄漏
 * @bdd EF-CACHE-001 带哈希资源可被强缓存（immutable）
 */
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'

  return {
    plugins: [vue()],
    build: {
      // EF-BUILD-003：生产环境关闭 sourcemap，避免源码泄漏；
      // 生产固定为 sourcemap: false，开发环境保留以便调试。
      sourcemap: isProduction ? false : true,
      rollupOptions: {
        output: {
          // EF-BUILD-002 / EF-CACHE-001：带内容哈希的资源名
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]',
          // EF-BUILD-001：将框架依赖拆到独立 vendor chunk
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('vue')) return 'vendor-vue'
              return 'vendor'
            }
          },
        },
      },
    },
  }
})
