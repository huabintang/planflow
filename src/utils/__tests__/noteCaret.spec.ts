import { describe, expect, it } from 'vitest'
import { computeBlankLineInsertion } from '../noteCaret'

describe('computeBlankLineInsertion', () => {
  const LH = 36 // 单行高度 18px × line-height 2

  it('点在第 0 行、文本为空：补足到第 1 行（1 个空行），光标落末尾', () => {
    const r = computeBlankLineInsertion({ offsetY: 0, lineHeightPx: LH, value: '' })
    expect(r.linesToAppend).toBe(1)
    expect(r.caretPos).toBe(1)
  })

  it('点在第 3 行、只有 1 行文字：补足 3 个空行', () => {
    const value = 'cdzs持续创新'
    const r = computeBlankLineInsertion({ offsetY: LH * 3 + 5, lineHeightPx: LH, value })
    // clickedLine=3, currentLines=1 → 补 3
    expect(r.linesToAppend).toBe(3)
    expect(r.caretPos).toBe(value.length + 3)
  })

  it('点在已有文本范围内：不补行，caretPos=-1（交给浏览器原生定位）', () => {
    const value = 'a\nb\nc' // 3 行
    const r = computeBlankLineInsertion({ offsetY: LH * 1 + 2, lineHeightPx: LH, value })
    expect(r.linesToAppend).toBe(0)
    expect(r.caretPos).toBe(-1)
  })

  it('点在最后一行文字所在行（同一行）：视为范围内，不补行', () => {
    const value = 'a\nb\nc' // 3 行，索引 0..2
    const r = computeBlankLineInsertion({ offsetY: LH * 2 + 1, lineHeightPx: LH, value })
    expect(r.linesToAppend).toBe(0)
    expect(r.caretPos).toBe(-1)
  })

  it('点在紧邻文本下方第一行空白：补足 1 行', () => {
    const value = 'a\nb\nc' // 3 行
    const r = computeBlankLineInsertion({ offsetY: LH * 3 + 1, lineHeightPx: LH, value })
    expect(r.linesToAppend).toBe(1)
    expect(r.caretPos).toBe(value.length + 1)
  })

  it('offsetY 为负（点在 padding 区域上方）：clickedLine 归零，不补行', () => {
    const value = 'x'
    const r = computeBlankLineInsertion({ offsetY: -20, lineHeightPx: LH, value })
    // clickedLine=0 < currentLines=1 → 不补
    expect(r.linesToAppend).toBe(0)
    expect(r.caretPos).toBe(-1)
  })

  it('lineHeightPx 为 0（异常/未取到样式）：防除零，不补行、光标置末尾', () => {
    const value = 'hello'
    const r = computeBlankLineInsertion({ offsetY: 100, lineHeightPx: 0, value })
    expect(r.linesToAppend).toBe(0)
    expect(r.caretPos).toBe(value.length)
  })

  it('lineHeightPx 为 NaN：同样防御，不补行', () => {
    const value = 'hello'
    const r = computeBlankLineInsertion({ offsetY: 100, lineHeightPx: Number.NaN, value })
    expect(r.linesToAppend).toBe(0)
    expect(r.caretPos).toBe(value.length)
  })
})
