import type { ParseResult, QueueTask, QueueType, TaskQueue } from '../types'

const MAX_TASKS_PER_FILE = 120
const MAX_DETAILS_PER_TASK = 24

const typeKeywords: Record<QueueType, string[]> = {
  学习: ['学习', '课程', '复习', '阅读', '读书', '练习', '背诵', '英语', '编程', '论文', '笔记'],
  工作: ['工作', '会议', '项目', '客户', '邮件', '汇报', '方案', '需求', '日报', '办公'],
  生活: ['生活', '买菜', '采购', '做饭', '家务', '整理', '打扫', '预约', '缴费', '购物'],
  运动: ['运动', '跑步', '健身', '瑜伽', '拉伸', '散步', '游泳', '训练'],
  其他: [],
}

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

const cleanMarkdown = (value: string) => value
  .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/[*_~]+/g, '')
  .replace(/<[^>]+>/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const inferType = (text: string): QueueType => {
  let winner: QueueType = '其他'
  let score = 0
    ; (Object.keys(typeKeywords) as QueueType[]).forEach((type) => {
      const current = typeKeywords[type].reduce((sum, keyword) => sum + (text.includes(keyword) ? 1 : 0), 0)
      if (current > score) {
        score = current
        winner = type
      }
    })
  return winner
}

const extractTime = (value: string) => {
  const match = value.match(/(?:^|\s|[（(\[])([01]?\d|2[0-3]):([0-5]\d)/)
  if (!match) return ''
  return `${match[1].padStart(2, '0')}:${match[2]}`
}

const removeLeadingTime = (value: string) => value.replace(
  /^\s*(?:[🕘🕙🕚🕛🕐🕑🕒🕓🕔🕕🕖🕗]\s*)?(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*(?:-|–|—|~|〜|至|到)\s*(?:[01]?\d|2[0-3]):[0-5]\d)?\s*[:：-]?\s*/,
  '',
)

type HourRange = { start: number; end: number }

const normalizeHourCode = (value: string | number) => {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? `H${String(number).padStart(3, '0')}` : ''
}

const extractHourRange = (value: string): HourRange | null => {
  const match = value.match(/(?:^|[^a-z0-9])H\s*(\d{1,3})\s*(?:-|–|—|~|〜|至|到)\s*H?\s*(\d{1,3})(?=$|[^a-z0-9])/i)
  if (!match) return null
  const first = Number(match[1])
  const second = Number(match[2])
  return { start: Math.min(first, second), end: Math.max(first, second) }
}

const parseHourHeading = (value: string) => {
  const cleaned = cleanMarkdown(value)
  const match = cleaned.match(/^(?:第\s*)?H\s*(\d{1,3})(.*)$/i)
  if (!match) return null

  const rawSuffix = match[2]
  const suffix = rawSuffix.trim()
  if (suffix && /^[-–—~〜至到]\s*H?\s*\d{1,3}(?:$|[\s:：、，,|｜])/.test(suffix)) return null

  const label = cleanMarkdown(
    suffix
      .replace(/^[:：、，,.。|｜·•—–\-]+\s*/, '')
      .replace(/^（\s*/, '')
      .replace(/^\(\s*/, '')
      .replace(/\s*[）)]$/, ''),
  )
  const number = Number(match[1])
  const code = normalizeHourCode(number)
  return { code, number, title: label || code }
}

const createTask = (titleValue: string, completed: boolean, contextTime: string, note: string): QueueTask | null => {
  const cleaned = cleanMarkdown(titleValue)
  const time = extractTime(cleaned) || contextTime
  const title = cleanMarkdown(removeLeadingTime(cleaned))
  if (title.length < 2 || title.length > 240 || /^[-—–|]+$/.test(title)) return null
  const now = new Date().toISOString()
  return {
    id: createId('task'),
    title,
    completed,
    time,
    note,
    details: [],
    createdAt: now,
    updatedAt: now,
  }
}

const parseTableRow = (line: string, contextTime: string, note: string) => {
  if (!/^\|.*\|$/.test(line) || /^\|?\s*:?-{3,}/.test(line)) return null
  const cells = line.split('|').map((cell) => cleanMarkdown(cell)).filter(Boolean)
  if (cells.length < 2 || cells.every((cell) => /^:?-+:?$/.test(cell))) return null
  const timeCell = cells.find((cell) => /^([01]?\d|2[0-3]):[0-5]\d/.test(cell))
  const taskCell = cells.find((cell) => cell !== timeCell && !/^(时间|时段|任务|事项|内容|状态|备注)$/.test(cell))
  if (!taskCell) return null
  return createTask(`${timeCell ?? ''} ${taskCell}`, /(?:已完成|完成|✅|\[x\])/i.test(line), contextTime, note)
}

export function parseMarkdown(content: string, filename: string): ParseResult {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const tasks: QueueTask[] = []
  const seen = new Set<string>()
  const hourRange = extractHourRange(filename)
  let contextTime = ''
  let section = ''
  let ignored = 0
  let inCodeBlock = false
  let lastTask: QueueTask | null = null
  let isHourDocument = Boolean(hourRange)

  const addTask = (task: QueueTask | null) => {
    if (!task) return
    const key = `${task.time}|${task.title}`.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    if (tasks.length < MAX_TASKS_PER_FILE) tasks.push(task)
  }

  const addHourDetail = (task: QueueTask | null, value: string) => {
    if (!task) return
    const detail = cleanMarkdown(value)
      .replace(/^(?:[-*+]\s+|\d+[.)]\s+)/, '')
      .replace(/^\[[ xX]\]\s+/, '')
      .replace(/^(?:说明|内容|重点|目标|材料|输出|步骤|备注)\s*[:：]\s*/, '')
      .trim()
      .slice(0, 280)
    if (!detail || /^[-—–|]+$/.test(detail)) return
    if (!task.details.includes(detail) && task.details.length < MAX_DETAILS_PER_TASK) task.details.push(detail)
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trim()
    if (/^```/.test(line)) {
      inCodeBlock = !inCodeBlock
      return
    }
    if (!line || inCodeBlock || /^<!--/.test(line)) return
    if (/^>/.test(line)) {
      if (isHourDocument) {
        addHourDetail(lastTask, line.replace(/^>\s*/, ''))
        return
      }
      if (lastTask) {
        const detail = cleanMarkdown(line.replace(/^>\s*/, ''))
        if (detail && !lastTask.details.includes(detail) && lastTask.details.length < MAX_DETAILS_PER_TASK) lastTask.details.push(detail)
      }
      return
    }

    const heading = line.match(/^#{1,6}\s+(.+)$/)
    if (heading) {
      const headingText = cleanMarkdown(heading[1])
      const hourHeading = parseHourHeading(headingText)
      if (hourHeading) {
        isHourDocument = true
        const task = createTask(hourHeading.title, false, hourHeading.code, '')
        addTask(task)
        lastTask = task
        section = headingText
        contextTime = hourHeading.code
        return
      }

      if (isHourDocument) {
        section = headingText
        contextTime = extractTime(section)
        addHourDetail(lastTask, section)
        return
      }

      section = headingText
      contextTime = extractTime(section)
      lastTask = null
      return
    }

    const standaloneHourHeading = parseHourHeading(line)
    if (standaloneHourHeading) {
      isHourDocument = true
      const task = createTask(standaloneHourHeading.title, false, standaloneHourHeading.code, '')
      addTask(task)
      lastTask = task
      section = line
      contextTime = standaloneHourHeading.code
      return
    }

    if (isHourDocument) {
      addHourDetail(lastTask, line)
      return
    }

    const indentedDetail = rawLine.match(/^\s{1,}(?:[-*+]\s+|\d+[.)]\s+)?(.+)$/)
    if (indentedDetail && lastTask) {
      const detail = cleanMarkdown(indentedDetail[1].replace(/^\[[ xX]\]\s+/, ''))
      if (detail && !lastTask.details.includes(detail) && lastTask.details.length < MAX_DETAILS_PER_TASK) lastTask.details.push(detail)
      return
    }

    if (/^(?:说明|内容|重点|目标|材料|输出|步骤|备注)\s*[:：]/.test(line) && lastTask) {
      const detail = cleanMarkdown(line.replace(/^(?:说明|内容|重点|目标|材料|输出|步骤|备注)\s*[:：]\s*/, ''))
      if (detail && !lastTask.details.includes(detail) && lastTask.details.length < MAX_DETAILS_PER_TASK) lastTask.details.push(detail)
      return
    }

    const indentation = rawLine.match(/^\s*/)?.[0].replace(/\t/g, '    ').length ?? 0
    const checkbox = line.match(/^(?:[-*+]\s+|\d+[.)]\s+)?\[([ xX])\]\s+(.+)$/)
    if (checkbox) {
      const task = createTask(checkbox[2], checkbox[1].toLowerCase() === 'x', contextTime, section)
      addTask(task)
      lastTask = task
      return
    }

    // Only top-level list items are tasks. Nested bullets are details of the previous task.
    const listItem = indentation === 0 ? line.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/) : null
    if (listItem) {
      const task = createTask(listItem[1], false, contextTime, section)
      addTask(task)
      lastTask = task
      return
    }

    // A plain line is accepted only when it begins with an explicit clock time.
    if (/^(?:[🕘🕙🕚🕛🕐🕑🕒🕓🕔🕕🕖🕗]\s*)?(?:[01]?\d|2[0-3]):[0-5]\d\s+/.test(line)) {
      const task = createTask(line, false, contextTime, section)
      addTask(task)
      lastTask = task
      return
    }

    const tableTask = parseTableRow(line, contextTime, section)
    if (tableTask) {
      addTask(tableTask)
      lastTask = tableTask
      return
    }

    ignored += 1
  })

  const now = new Date().toISOString()
  const queueName = filename.replace(/\.(?:md|markdown|txt)$/i, '') || '未命名队列'
  const truncated = seen.size > MAX_TASKS_PER_FILE
  const hourRangeLabel = hourRange
    ? `${normalizeHourCode(hourRange.start)}–${normalizeHourCode(hourRange.end)}`
    : ''
  const importMessage = tasks.length
    ? isHourDocument
      ? `${tasks.length} 个小时任务${hourRangeLabel ? `（${hourRangeLabel}）` : ''}${truncated ? `（已限制为每个文件最多 ${MAX_TASKS_PER_FILE} 项）` : ''}`
      : `${tasks.length} 个明确任务${truncated ? `（已限制为每个文件最多 ${MAX_TASKS_PER_FILE} 项）` : ''}`
    : isHourDocument
      ? '未识别到 H001、H002 这类小时标题，可手动添加'
      : '未识别到勾选项、顶级列表或带时间的任务，可手动添加'

  const queue: TaskQueue = {
    id: createId('queue'),
    name: queueName,
    sourceName: filename,
    type: inferType(`${filename}\n${content.slice(0, 1200)}`),
    tasks,
    createdAt: now,
    updatedAt: now,
    importMessage,
    // 保留原始 Markdown 全文，供全屏阅读器渲染成富文本。
    rawContent: content,
  }


  return { queue, recognized: tasks.length, ignored, truncated }
}
