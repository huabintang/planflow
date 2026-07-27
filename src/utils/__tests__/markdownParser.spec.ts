import { describe, expect, it } from 'vitest'
import { parseMarkdown } from '../markdownParser'

/**
 * TDD 用例：Markdown 解析器领域逻辑。
 * 每个 it 标题标注对应的 BDD 场景编号，实现文档 ⇄ 测试双向可追溯。
 */
describe('parseMarkdown', () => {
  it('EF-PARSE-001 勾选项识别为任务且保留完成状态', () => {
    const md = ['# 计划', '- [ ] 写周报', '- [x] 整理笔记'].join('\n')
    const { queue } = parseMarkdown(md, 'plan.md')
    const titles = queue.tasks.map((t) => t.title)
    expect(titles).toContain('写周报')
    expect(titles).toContain('整理笔记')
    expect(queue.tasks.find((t) => t.title === '整理笔记')?.completed).toBe(true)
    expect(queue.tasks.find((t) => t.title === '写周报')?.completed).toBe(false)
  })

  it('EF-PARSE-002 顶级列表是任务、缩进子列表是明细', () => {
    const md = ['# 计划', '- 完成课程', '  - 看视频', '  - 做练习'].join('\n')
    const { queue } = parseMarkdown(md, 'plan.md')
    expect(queue.tasks).toHaveLength(1)
    expect(queue.tasks[0].title).toBe('完成课程')
    expect(queue.tasks[0].details).toEqual(['看视频', '做练习'])
  })

  it('EF-PARSE-003 普通说明段落被忽略', () => {
    const md = ['# 计划', '这是一段普通说明文字不应成为任务', '- 真正的任务'].join('\n')
    const { queue, ignored } = parseMarkdown(md, 'plan.md')
    expect(queue.tasks.map((t) => t.title)).toEqual(['真正的任务'])
    expect(ignored).toBeGreaterThan(0)
  })

  it('EF-PARSE-004 H001 小时标题生成独立小时任务', () => {
    const md = ['# 课程', '## H001', '安装环境', '## H002：基础类型', '理解类型'].join('\n')
    const { queue } = parseMarkdown(md, 'course.md')
    const times = queue.tasks.map((t) => t.time)
    expect(times).toContain('H001')
    expect(times).toContain('H002')
    // 无名称的 H001 以编号作为标题
    expect(queue.tasks.find((t) => t.time === 'H001')?.title).toBe('H001')
    expect(queue.tasks.find((t) => t.time === 'H002')?.title).toBe('基础类型')
  })

  it('EF-PARSE-005 时间格式被规范化', () => {
    const md = ['## 学习 · 08:00-10:00', '- [ ] 完成课程'].join('\n')
    const { queue } = parseMarkdown(md, 'plan.md')
    expect(queue.tasks[0].time).toBe('08:00')
  })

  it('EF-PARSE-006 单文件任务数量上限保护', () => {
    const lines = ['# 大文件']
    for (let i = 0; i < 150; i += 1) lines.push(`- 任务编号 ${i}`)
    const { queue, truncated } = parseMarkdown(lines.join('\n'), 'big.md')
    expect(queue.tasks).toHaveLength(120)
    expect(truncated).toBe(true)
  })

  it('EF-PARSE-007 相同时间+标题的任务去重', () => {
    const md = ['# 计划', '- [ ] 重复任务', '- [ ] 重复任务'].join('\n')
    const { queue } = parseMarkdown(md, 'plan.md')
    expect(queue.tasks).toHaveLength(1)
  })

  it('EF-PARSE-008 队列类型按关键词推断', () => {
    const md = ['# 今日运动', '- 跑步 5 公里', '- 拉伸 15 分钟'].join('\n')
    const { queue } = parseMarkdown(md, 'sport.md')
    expect(queue.type).toBe('运动')
  })
})
