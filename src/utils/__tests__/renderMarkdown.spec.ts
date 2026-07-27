// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../renderMarkdown'


/**
 * TDD 用例：全屏阅读器的 Markdown → 富文本渲染工具。
 *
 * 说明：DOMPurify 依赖浏览器 DOM，故本文件通过顶部 `@vitest-environment jsdom`
 * 单独切到 jsdom 环境（其余测试文件仍保持 node）。
 */

describe('renderMarkdown', () => {
  it('EF-READER-001 标题与列表渲染为对应的富文本标签', () => {
    const html = renderMarkdown(['# 标题', '', '- 第一项', '- 第二项'].join('\n'))
    expect(html).toContain('<h1')
    expect(html).toContain('标题')
    expect(html).toContain('<ul>')
    expect(html).toContain('第一项')
  })

  it('EF-READER-002 加粗与链接被正确渲染', () => {
    const html = renderMarkdown('这是 **重点** 和 [链接](https://example.com)')
    expect(html).toContain('<strong>重点</strong>')
    expect(html).toContain('href="https://example.com"')
  })

  it('EF-READER-003 空输入返回空字符串', () => {
    expect(renderMarkdown('')).toBe('')
    expect(renderMarkdown('   \n  ')).toBe('')
  })
})
