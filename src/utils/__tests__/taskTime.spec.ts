import { describe, expect, it } from 'vitest'
import { isHourTaskTime, motivationForTime, normalizeTaskTime, timeToMinutes } from '../taskTime'

/**
 * TDD 用例：任务时间纯函数。
 * 覆盖 BDD 场景 EF-PARSE-005 / EF-NAME-002。
 */
describe('taskTime 纯函数', () => {
  describe('timeToMinutes', () => {
    it('EF-PARSE-005 将 HH:MM 转换为分钟', () => {
      expect(timeToMinutes('08:30')).toBe(510)
      expect(timeToMinutes('00:00')).toBe(0)
    })

    it('EF-PARSE-004 将 Hxxx 小时编号转换为分钟', () => {
      expect(timeToMinutes('H001')).toBe(60)
      expect(timeToMinutes('H010')).toBe(600)
    })

    it('未安排的时间排到最后（1440）', () => {
      expect(timeToMinutes('')).toBe(1440)
      expect(timeToMinutes('待安排')).toBe(1440)
    })
  })

  describe('normalizeTaskTime', () => {
    it('EF-PARSE-005 补零 HH:MM', () => {
      expect(normalizeTaskTime('8:30')).toBe('08:30')
      expect(normalizeTaskTime(' 08:30 ')).toBe('08:30')
    })

    it('EF-PARSE-004 规范化 H 编号为三位', () => {
      expect(normalizeTaskTime('H1')).toBe('H001')
      expect(normalizeTaskTime('h 24')).toBe('H024')
    })

    it('非法输入按 20 字截断保留', () => {
      expect(normalizeTaskTime('随便写点')).toBe('随便写点')
    })
  })

  describe('isHourTaskTime', () => {
    it('EF-PARSE-004 识别小时任务', () => {
      expect(isHourTaskTime('H001')).toBe(true)
      expect(isHourTaskTime('08:00')).toBe(false)
      expect(isHourTaskTime('')).toBe(false)
    })
  })

  describe('motivationForTime', () => {
    const list = ['A', 'B', 'C']

    it('按小时编号取对应励志语', () => {
      expect(motivationForTime('H001', list)).toBe('A')
      expect(motivationForTime('H002', list)).toBe('B')
    })

    it('超出长度时循环取用', () => {
      expect(motivationForTime('H004', list)).toBe('A')
    })

    it('非小时任务回退到第一条', () => {
      expect(motivationForTime('08:00', list)).toBe('A')
    })

    it('空列表返回空字符串', () => {
      expect(motivationForTime('H001', [])).toBe('')
    })
  })
})
