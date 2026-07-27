import { describe, expect, it } from 'vitest'
import { formatNote, noteFileName } from '../noteFormat'

/**
 * TDD 用例：笔记导出格式化纯函数。
 * 覆盖「小记模式」导出前的空格与段落整理。
 */
describe('formatNote', () => {
  it('去除行尾多余空格', () => {
    expect(formatNote('第一行   \n第二行\t')).toBe('第一行\n第二行')
  })

  it('折叠行内连续空格为单个', () => {
    expect(formatNote('理解    这个    概念')).toBe('理解 这个 概念')
  })

  it('连续多个空行压缩为最多一个空行', () => {
    const raw = ['段落一', '', '', '', '段落二'].join('\n')
    expect(formatNote(raw)).toBe('段落一\n\n段落二')
  })

  it('去除全文首尾空白', () => {
    expect(formatNote('\n\n  正文  \n\n')).toBe('正文')
  })

  it('空输入返回空字符串', () => {
    expect(formatNote('')).toBe('')
  })
})

describe('noteFileName', () => {
  it('生成 队列名-笔记.md', () => {
    expect(noteFileName('周四计划')).toBe('周四计划-笔记.md')
  })

  it('剔除文件系统非法字符', () => {
    expect(noteFileName('计划/2025:草稿')).toBe('计划2025草稿-笔记.md')
  })

  it('空名兜底为未命名', () => {
    expect(noteFileName('   ')).toBe('未命名-笔记.md')
  })
})
