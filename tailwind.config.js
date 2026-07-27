/**
 * Tailwind 配置。
 *
 * @bdd EF-CSS-002 设计令牌通过主题暴露
 * 将品牌薄荷绿配色抽为语义色（sage/orange/ink/...），供模板用 text-sage、bg-orange 等原子类引用。
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  /**
   * 队列类型配色类由 `:class="`type-${queue.type}`"` 动态拼接，
   * Tailwind 静态扫描无法识别完整类名，需显式 safelist 避免生产被 purge 掉色。
   */
  safelist: ['type-学习', 'type-工作', 'type-生活', 'type-运动', 'type-其他'],

  theme: {
    extend: {
      colors: {
        ink: '#163a29',
        muted: '#587567',
        faint: '#759083',
        line: '#bfe0cc',
        paper: '#f8fff9',
        sage: {
          DEFAULT: '#16a86b',
          dark: '#087849',
          soft: '#dcf8e8',
        },
        orange: {
          DEFAULT: '#ff6b3d',
          soft: '#fff0df',
        },
      },
      fontFamily: {
        sans: ['Noto Sans SC', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      boxShadow: {
        floating: '0 28px 72px rgba(21, 126, 77, .2)',
      },
    },
  },
  plugins: [],
}
