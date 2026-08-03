import { describe, expect, it } from 'vitest'
import type { DailyTemplate, QueueTask } from '../../types'
import { describeRepeat, generateDailyTasks, repeatMatches, toDateKey } from '../dailyPlan'

let counter = 0
const createId = (prefix: string) => `${prefix}-${counter++}`

const makeTemplate = (over: Partial<DailyTemplate> = {}): DailyTemplate => ({
  id: 't1',
  title: '喝水',
  note: '',
  details: [],
  repeat: { kind: 'daily', days: [] },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

describe('toDateKey', () => {
  it('formats local date as YYYY-MM-DD', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toDateKey(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
})

describe('repeatMatches', () => {
  it('daily matches every weekday', () => {
    for (let d = 0; d < 7; d++) {
      expect(repeatMatches({ kind: 'daily', days: [] }, d as 0)).toBe(true)
    }
  })

  it('weekly matches only listed days', () => {
    const rule = { kind: 'weekly' as const, days: [1, 3, 5] as (1 | 3 | 5)[] }
    expect(repeatMatches(rule, 1)).toBe(true)
    expect(repeatMatches(rule, 2)).toBe(false)
    expect(repeatMatches(rule, 5)).toBe(true)
  })
})

describe('describeRepeat', () => {
  it('describes daily and full-week as 每天', () => {
    expect(describeRepeat({ kind: 'daily', days: [] })).toBe('每天')
    expect(describeRepeat({ kind: 'weekly', days: [0, 1, 2, 3, 4, 5, 6] })).toBe('每天')
  })

  it('recognizes 工作日 and 周末', () => {
    expect(describeRepeat({ kind: 'weekly', days: [1, 2, 3, 4, 5] })).toBe('工作日')
    expect(describeRepeat({ kind: 'weekly', days: [0, 6] })).toBe('周末')
  })

  it('lists specific weekdays in order', () => {
    expect(describeRepeat({ kind: 'weekly', days: [5, 1, 3] })).toBe('周一、周三、周五')
  })

  it('handles empty weekly selection', () => {
    expect(describeRepeat({ kind: 'weekly', days: [] })).toBe('未选择日期')
  })
})

describe('generateDailyTasks', () => {
  it('generates one task per matching daily template', () => {
    const tasks = generateDailyTasks([makeTemplate()], [], new Date(2026, 0, 5), createId)
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({
      title: '喝水',
      completed: false,
      time: '',
      templateId: 't1',
      planDate: '2026-01-05',
    })
  })

  it('skips weekly templates that do not match today', () => {
    // 2026-01-05 is a Monday (getDay() === 1)
    const wed = makeTemplate({ repeat: { kind: 'weekly', days: [3] } })
    const mon = makeTemplate({ id: 't2', repeat: { kind: 'weekly', days: [1] } })
    const tasks = generateDailyTasks([wed, mon], [], new Date(2026, 0, 5), createId)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].templateId).toBe('t2')
  })

  it('is idempotent for the same day (no duplicates)', () => {
    const date = new Date(2026, 0, 5)
    const first = generateDailyTasks([makeTemplate()], [], date, createId)
    const second = generateDailyTasks([makeTemplate()], first, date, createId)
    expect(second).toHaveLength(0)
  })

  it('generates a fresh, independent task the next day', () => {
    const day1 = new Date(2026, 0, 5)
    const day2 = new Date(2026, 0, 6)
    const t1 = generateDailyTasks([makeTemplate()], [], day1, createId)
    // mark day1 task done — should not affect day2 generation
    const done: QueueTask[] = t1.map((task) => ({ ...task, completed: true }))
    const t2 = generateDailyTasks([makeTemplate()], done, day2, createId)
    expect(t2).toHaveLength(1)
    expect(t2[0].planDate).toBe('2026-01-06')
    expect(t2[0].completed).toBe(false)
    expect(t2[0].id).not.toBe(t1[0].id)
  })

  it('copies note and details from the template', () => {
    const template = makeTemplate({ note: '记得空腹', details: ['300ml', '常温'] })
    const tasks = generateDailyTasks([template], [], new Date(2026, 0, 5), createId)
    expect(tasks[0].note).toBe('记得空腹')
    expect(tasks[0].details).toEqual(['300ml', '常温'])
    // details should be a copy, not the same reference
    expect(tasks[0].details).not.toBe(template.details)
  })
})
