<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import BaseIcon from './components/BaseIcon.vue'
import ReaderOverlay from './components/ReaderOverlay.vue'
import type { DailyTemplate, QueueTask, QueueType, RepeatRule, TaskFilter, TaskQueue, Weekday } from './types'
import { parseMarkdown } from './utils/markdownParser'
import { describeRepeat, generateDailyTasks } from './utils/dailyPlan'


const STORAGE_KEY = 'planflow.file-queues.v2'
const MAX_TASK_DETAILS = 24
const DAILY_QUEUE_ID = 'queue-daily-plan'
const queueTypes: QueueType[] = ['学习', '工作', '生活', '运动', '其他']
// 周一在前、周日在后的选择顺序，value 与 Date.getDay() 对齐（0=周日）。
const weekdayOptions: { value: Weekday; label: string }[] = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 0, label: '周日' },
]
const hourMotivations = [
  '从这一小时开始，把想法一步步变成真正的能力。',
  '你今天啃下的难点，都会成为明天从容前行的底气。',
  '每一次全神贯注，都是在为更强大的自己积蓄力量。',
  '别怕走得慢，只要没有停下，你就一直在赢。',
  '把眼前这一小时做到极致，成长自然会给你答案。',
  '难题不是阻碍，而是能力升级最宝贵的入口。',
  '你比想象中更有韧性，再向前一步，突破就在前方。',
  '专注拿下这一小时，你的未来会因此悄悄改变。',
  '持续行动的人，终会亲手把目标变成现实。',
  '今天多理解一点，明天就会多一份自信与从容。',
  '真正的进步，正藏在每一次选择不放弃的瞬间。',
  '把复杂拆开，把困难逐个击破，你一定做得到。',
  '你的每一分认真都不会白费，它正在悄悄产生复利。',
  '坚持完成这一小时，就是今天又一次漂亮的胜利。',
  '你正在掌握曾经觉得遥不可及的东西，继续向前。',
  '答案往往就在下一次尝试里，勇敢再试一次。',
  '让今天的专注，成为明天面对挑战时的自信。',
  '每完成一个小时，你都在靠近理想中的自己。',
  '越过眼前这道坎，你的能力就会再上一个台阶。',
  '保持热爱，保持行动，时间一定会奖励认真前行的你。',
  '此刻的坚持，正在为未来的你打开更多选择。',
  '不必一口气抵达终点，先漂亮地拿下这一小时。',
  '你已经走了很远，再坚持一下，突破正在发生。',
  '完成最后这一小时，为这段努力的旅程漂亮收官。',
]

const queues = ref<TaskQueue[]>([])
const selectedQueueId = ref('')
const queueSearch = ref('')
const taskSearch = ref('')
const quickTaskTitle = ref('')
const taskFilter = ref<TaskFilter>('all')
const fileInput = ref<HTMLInputElement | null>(null)
const isImporting = ref(false)
const isDragging = ref(false)
const dragDepth = ref(0)
const sidebarOpen = ref(false)
const changedTaskId = ref('')
const expandedTaskId = ref('')
const readerOpen = ref(false)


const modalMode = ref<'task' | 'queue' | null>(null)
const editingTaskId = ref('')
const editingQueueId = ref('')
const taskDraft = ref({
  title: '',
  time: '',
  note: '',
  details: '',
  repeat: 'none' as 'none' | 'daily' | 'weekly',
  weekdays: [] as Weekday[],
})
const queueDraft = ref<{ name: string; type: QueueType }>({ name: '', type: '其他' })
const confirmTarget = ref<{ kind: 'task' | 'queue'; id: string; name: string } | null>(null)
const toast = ref({ visible: false, title: '', detail: '', tone: 'success' as 'success' | 'warning' })
let toastTimer: number | undefined
let changedTimer: number | undefined

const selectedQueue = computed(() => queues.value.find((queue) => queue.id === selectedQueueId.value) ?? null)

const visibleQueues = computed(() => {
  const query = queueSearch.value.trim().toLowerCase()
  if (!query) return queues.value
  return queues.value.filter((queue) => `${queue.name} ${queue.sourceName} ${queue.type}`.toLowerCase().includes(query))
})

const queueTaskCount = computed(() => queues.value.reduce((sum, queue) => sum + queue.tasks.length, 0))
const queueCompletedCount = computed(() => queues.value.reduce((sum, queue) => sum + queue.tasks.filter((task) => task.completed).length, 0))
const selectedCompleted = computed(() => selectedQueue.value?.tasks.filter((task) => task.completed).length ?? 0)
const selectedTotal = computed(() => selectedQueue.value?.tasks.length ?? 0)
const selectedProgress = computed(() => selectedTotal.value ? Math.round(selectedCompleted.value / selectedTotal.value * 100) : 0)
const focusedHourTask = computed(() => {
  const hourTasks = selectedQueue.value?.tasks
    .filter(isHourTask)
    .slice()
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)) ?? []
  if (!hourTasks.length) return null
  return hourTasks.find((task) => task.id === expandedTaskId.value)
    ?? hourTasks.find((task) => !task.completed)
    ?? hourTasks[hourTasks.length - 1]
})

const filteredTasks = computed(() => {
  if (!selectedQueue.value) return []
  const query = taskSearch.value.trim().toLowerCase()
  return [...selectedQueue.value.tasks]
    .filter((task) => {
      if (taskFilter.value === 'todo' && task.completed) return false
      if (taskFilter.value === 'done' && !task.completed) return false
      return !query || `${task.title} ${task.note} ${task.time}`.toLowerCase().includes(query)
    })
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time) || a.createdAt.localeCompare(b.createdAt))
})

const taskFilterCounts = computed(() => ({
  all: selectedTotal.value,
  todo: selectedTotal.value - selectedCompleted.value,
  done: selectedCompleted.value,
}))

const showToast = (title: string, detail: string, tone: 'success' | 'warning' = 'success') => {
  if (toastTimer) window.clearTimeout(toastTimer)
  toast.value = { visible: true, title, detail, tone }
  toastTimer = window.setTimeout(() => { toast.value.visible = false }, 3000)
}

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ queues: queues.value, selectedQueueId: selectedQueueId.value }))
  } catch {
    showToast('保存失败', '浏览器本地存储当前不可用', 'warning')
  }
}

onMounted(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const data = JSON.parse(saved) as { queues?: TaskQueue[]; selectedQueueId?: string }
      queues.value = Array.isArray(data.queues) ? data.queues.map((queue) => ({
        ...queue,
        templates: Array.isArray(queue.templates) ? queue.templates : undefined,
        tasks: Array.isArray(queue.tasks) ? queue.tasks.map((task) => ({
          ...task,
          note: task.note ?? '',
          details: Array.isArray(task.details) ? task.details : [],
        })) : [],
      })) : []
      selectedQueueId.value = data.selectedQueueId ?? queues.value[0]?.id ?? ''
      if (!queues.value.some((queue) => queue.id === selectedQueueId.value)) selectedQueueId.value = queues.value[0]?.id ?? ''
    }
  } catch {
    queues.value = []
    selectedQueueId.value = ''
  }
  // 打开应用时，为今天补齐每日计划任务（只生成今天、已生成的不重复）。
  runDailyGeneration()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
watch([queues, selectedQueueId], persist, { deep: true })

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    modalMode.value = null
    confirmTarget.value = null
    sidebarOpen.value = false
  }
}

function timeToMinutes(time: string) {
  const hourCode = time.match(/^H(\d{1,3})$/i)
  if (hourCode) return Number(hourCode[1]) * 60
  const match = time.match(/^(\d{2}):(\d{2})$/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : 1440
}

function normalizeTaskTime(time: string) {
  const value = time.trim()
  const hourCode = value.match(/^H\s*(\d{1,3})$/i)
  if (hourCode) return `H${String(Number(hourCode[1])).padStart(3, '0')}`
  const clock = value.match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  return clock ? `${clock[1].padStart(2, '0')}:${clock[2]}` : value.slice(0, 20)
}

function isHourTask(task: QueueTask) {
  return /^H\d{1,3}$/i.test(task.time)
}

function motivationForTask(task: QueueTask) {
  const match = task.time.match(/^H(\d{1,3})$/i)
  const hour = match ? Number(match[1]) : 1
  return hourMotivations[(Math.max(1, hour) - 1) % hourMotivations.length]
}

const queueProgress = (queue: TaskQueue) => {
  if (!queue.tasks.length) return 0
  return Math.round(queue.tasks.filter((task) => task.completed).length / queue.tasks.length * 100)
}

const selectQueue = (id: string) => {
  selectedQueueId.value = id
  taskSearch.value = ''
  taskFilter.value = 'all'
  expandedTaskId.value = ''
  sidebarOpen.value = false
}

const touchQueue = (queue: TaskQueue) => {
  queue.updatedAt = new Date().toISOString()
}

const flashTask = (id: string) => {
  if (changedTimer) window.clearTimeout(changedTimer)
  changedTaskId.value = id
  changedTimer = window.setTimeout(() => { changedTaskId.value = '' }, 650)
}

const toggleTask = (task: QueueTask) => {
  if (!selectedQueue.value) return
  task.completed = !task.completed
  task.updatedAt = new Date().toISOString()
  touchQueue(selectedQueue.value)
  flashTask(task.id)
  showToast(task.completed ? '已标记完成' : '已恢复为待办', task.title)
}

const toggleExpanded = (taskId: string) => {
  expandedTaskId.value = expandedTaskId.value === taskId ? '' : taskId
}

const quickAddTask = () => {
  const queue = selectedQueue.value
  const title = quickTaskTitle.value.trim()
  if (!queue || !title) return
  const now = new Date().toISOString()
  const task: QueueTask = {
    id: createId('task'),
    title,
    completed: false,
    time: '',
    note: '',
    details: [],
    createdAt: now,
    updatedAt: now,
  }
  queue.tasks.push(task)
  touchQueue(queue)
  quickTaskTitle.value = ''
  flashTask(task.id)
  showToast('任务已添加', title)
}

const openNewTask = () => {
  if (!selectedQueue.value) return
  editingTaskId.value = ''
  taskDraft.value = { title: '', time: '', note: '', details: '', repeat: 'none', weekdays: [] }
  modalMode.value = 'task'
}

const openEditTask = (task: QueueTask) => {
  editingTaskId.value = task.id
  let repeat: 'none' | 'daily' | 'weekly' = 'none'
  let weekdays: Weekday[] = []
  const template = task.templateId ? findTemplate(task.templateId) : null
  if (template) {
    repeat = template.repeat.kind
    weekdays = [...template.repeat.days]
  }
  taskDraft.value = { title: task.title, time: task.time, note: task.note, details: task.details.join('\n'), repeat, weekdays }
  modalMode.value = 'task'
}

// —— 每日计划：模板存放于固定的“每日计划”队列，行为与普通导入队列隔离 ——

const findDailyQueue = () => queues.value.find((queue) => queue.id === DAILY_QUEUE_ID) ?? null

const findTemplate = (templateId: string): DailyTemplate | null =>
  findDailyQueue()?.templates?.find((template) => template.id === templateId) ?? null

const ensureDailyQueue = (): TaskQueue => {
  let queue = findDailyQueue()
  if (!queue) {
    const now = new Date().toISOString()
    queue = {
      id: DAILY_QUEUE_ID,
      name: '每日计划',
      sourceName: '每日计划',
      type: '其他',
      tasks: [],
      createdAt: now,
      updatedAt: now,
      importMessage: '每日计划：按你设定的重复规则，每天自动生成当天的任务。',
      templates: [],
    }
    queues.value.unshift(queue)
  }
  if (!queue.templates) queue.templates = []
  return queue
}

const runDailyGeneration = () => {
  const queue = findDailyQueue()
  if (!queue?.templates?.length) return
  const generated = generateDailyTasks(queue.templates, queue.tasks, new Date(), createId)
  if (generated.length) {
    queue.tasks.push(...generated)
    queue.updatedAt = new Date().toISOString()
  }
}

const toggleWeekday = (day: Weekday) => {
  const index = taskDraft.value.weekdays.indexOf(day)
  if (index >= 0) taskDraft.value.weekdays.splice(index, 1)
  else taskDraft.value.weekdays.push(day)
}

const repeatLabelForTask = (task: QueueTask) => {
  const template = task.templateId ? findTemplate(task.templateId) : null
  return template ? describeRepeat(template.repeat) : ''
}

const stopRepeat = (task: QueueTask) => {
  const queue = findDailyQueue()
  if (!task.templateId || !queue?.templates) return
  queue.templates = queue.templates.filter((template) => template.id !== task.templateId)
  touchQueue(queue)
  showToast('已停止重复', `「${task.title}」以后不再自动生成`)
}

const saveTask = () => {
  const title = taskDraft.value.title.trim()
  if (!title) return
  const now = new Date().toISOString()
  const note = taskDraft.value.note.trim()
  const details = taskDraft.value.details.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, MAX_TASK_DETAILS)
  const taskTime = normalizeTaskTime(taskDraft.value.time)
  const kind = taskDraft.value.repeat
  const repeat: RepeatRule | null =
    kind === 'daily' ? { kind: 'daily', days: [] }
      : kind === 'weekly' ? { kind: 'weekly', days: [...taskDraft.value.weekdays].sort((a, b) => a - b) }
        : null
  // 每周指定至少要选一天，否则不保存。
  if (repeat?.kind === 'weekly' && !repeat.days.length) return

  if (editingTaskId.value) {
    const queue = selectedQueue.value
    const task = queue?.tasks.find((item) => item.id === editingTaskId.value)
    if (!queue || !task) return
    task.title = title
    task.time = taskTime
    task.note = note
    task.details = details
    task.updatedAt = now
    // 若这是由每日模板生成的任务，同步更新模板，让以后生成也跟着改。
    const template = task.templateId ? findTemplate(task.templateId) : null
    if (template) {
      template.title = title
      template.note = note
      template.details = [...details]
      if (repeat) template.repeat = repeat
      template.updatedAt = now
    }
    touchQueue(queue)
    flashTask(task.id)
    showToast('任务已保存', title)
    modalMode.value = null
    return
  }

  // 新建且设置了重复：存为每日计划模板，并立即为今天生成（若命中）。
  if (repeat) {
    const queue = ensureDailyQueue()
    const template: DailyTemplate = {
      id: createId('tpl'),
      title,
      note,
      details,
      repeat,
      createdAt: now,
      updatedAt: now,
    }
    queue.templates!.push(template)
    const generated = generateDailyTasks([template], queue.tasks, new Date(), createId)
    queue.tasks.push(...generated)
    touchQueue(queue)
    selectedQueueId.value = queue.id
    if (generated[0]) flashTask(generated[0].id)
    showToast('每日计划已创建', `${title} · ${describeRepeat(repeat)}`)
    modalMode.value = null
    return
  }

  // 新建普通一次性任务。
  const queue = selectedQueue.value
  if (!queue) return
  const task: QueueTask = {
    id: createId('task'),
    title,
    completed: false,
    time: taskTime,
    note,
    details,
    createdAt: now,
    updatedAt: now,
  }
  queue.tasks.push(task)
  touchQueue(queue)
  flashTask(task.id)
  showToast('任务已添加', `已加入「${queue.name}」`)
  modalMode.value = null
}

const openNewQueue = () => {
  editingQueueId.value = ''
  queueDraft.value = { name: '', type: '其他' }
  modalMode.value = 'queue'
}

const openEditQueue = () => {
  if (!selectedQueue.value) return
  editingQueueId.value = selectedQueue.value.id
  queueDraft.value = { name: selectedQueue.value.name, type: selectedQueue.value.type }
  modalMode.value = 'queue'
}

const saveQueue = () => {
  const name = queueDraft.value.name.trim()
  if (!name) return
  if (editingQueueId.value) {
    const queue = queues.value.find((item) => item.id === editingQueueId.value)
    if (!queue) return
    queue.name = name
    queue.type = queueDraft.value.type
    touchQueue(queue)
    showToast('队列已更新', name)
  } else {
    createQueue(name)
  }
  editingQueueId.value = ''
  modalMode.value = null
}

const createQueue = (name: string) => {
  const now = new Date().toISOString()
  const queue: TaskQueue = {
    id: createId('queue'),
    name,
    sourceName: `${name}.md`,
    type: queueDraft.value.type,
    tasks: [],
    createdAt: now,
    updatedAt: now,
    importMessage: '手动创建的空队列',
  }
  queues.value.unshift(queue)
  selectedQueueId.value = queue.id
  showToast('队列已创建', name)
}

const requestDeleteTask = (task: QueueTask) => {
  confirmTarget.value = { kind: 'task', id: task.id, name: task.title }
}

const requestDeleteQueue = (queue: TaskQueue) => {
  confirmTarget.value = { kind: 'queue', id: queue.id, name: queue.name }
}

const confirmDelete = () => {
  const target = confirmTarget.value
  if (!target) return
  if (target.kind === 'task' && selectedQueue.value) {
    selectedQueue.value.tasks = selectedQueue.value.tasks.filter((task) => task.id !== target.id)
    touchQueue(selectedQueue.value)
    showToast('任务已删除', target.name)
  } else {
    const index = queues.value.findIndex((queue) => queue.id === target.id)
    queues.value = queues.value.filter((queue) => queue.id !== target.id)
    if (selectedQueueId.value === target.id) {
      selectedQueueId.value = queues.value[Math.min(index, queues.value.length - 1)]?.id ?? ''
    }
    showToast('队列已删除', target.name)
  }
  confirmTarget.value = null
}

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

const openFilePicker = () => {
  if (!isImporting.value) fileInput.value?.click()
}

const importFiles = async (input: FileList | File[]) => {
  const validFiles = Array.from(input).filter((file) => /\.(md|markdown|txt)$/i.test(file.name))
  if (!validFiles.length) {
    showToast('没有可导入的文件', '请选择 .md、.markdown 或 .txt 文件', 'warning')
    return
  }

  isImporting.value = true
  try {
    const results = await Promise.all(validFiles.map(async (file) => parseMarkdown(await file.text(), file.name)))
    let taskCount = 0
    let emptyCount = 0
    let truncatedCount = 0
    let firstQueueId = ''

    results.forEach(({ queue, recognized, truncated }) => {
      const existingIndex = queues.value.findIndex((item) => item.sourceName === queue.sourceName)
      if (existingIndex >= 0) {
        const existing = queues.value[existingIndex]
        const oldTasks = new Map(existing.tasks.map((task) => [`${task.time}|${task.title}`.toLowerCase(), task]))
        queue.id = existing.id
        queue.name = existing.name
        queue.type = existing.type
        queue.createdAt = existing.createdAt
        queue.tasks = queue.tasks.map((task) => {
          const oldTask = oldTasks.get(`${task.time}|${task.title}`.toLowerCase())
          return oldTask ? { ...task, id: oldTask.id, completed: oldTask.completed, createdAt: oldTask.createdAt } : task
        })
        queues.value.splice(existingIndex, 1, queue)
      } else {
        queues.value.push(queue)
      }
      firstQueueId ||= queue.id
      taskCount += recognized
      if (!recognized) emptyCount += 1
      if (truncated) truncatedCount += 1
    })

    selectedQueueId.value = firstQueueId
    taskFilter.value = 'all'
    taskSearch.value = ''
    const details = [`${results.length} 个文件 = ${results.length} 个独立队列`, `${taskCount} 个明确任务`]
    if (emptyCount) details.push(`${emptyCount} 个空队列`)
    if (truncatedCount) details.push(`${truncatedCount} 个文件触发数量保护`)
    showToast('导入完成', details.join(' · '), truncatedCount ? 'warning' : 'success')
  } catch {
    showToast('导入失败', '读取文件时发生错误，请重试', 'warning')
  } finally {
    isImporting.value = false
  }
}

const onFileInput = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files?.length) await importFiles(input.files)
  input.value = ''
}

const onDragEnter = (event: DragEvent) => {
  if (!event.dataTransfer?.types.includes('Files')) return
  dragDepth.value += 1
  isDragging.value = true
}

const onDragLeave = () => {
  dragDepth.value = Math.max(0, dragDepth.value - 1)
  if (!dragDepth.value) isDragging.value = false
}

const onDrop = async (event: DragEvent) => {
  dragDepth.value = 0
  isDragging.value = false
  if (event.dataTransfer?.files.length) await importFiles(event.dataTransfer.files)
}

const exportQueue = () => {
  const queue = selectedQueue.value
  if (!queue) return
  const lines = [`# ${queue.name}`, '']
  queue.tasks
    .slice()
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
    .forEach((task) => {
      lines.push(`- [${task.completed ? 'x' : ' '}] ${task.time ? `${task.time} ` : ''}${task.title}`)
      if (task.note) lines.push(`  - ${task.note}`)
      task.details.forEach((detail) => lines.push(`  - ${detail}`))
    })
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${queue.name}.md`
  anchor.click()
  URL.revokeObjectURL(url)
  showToast('队列已导出', `${queue.name}.md`)
}

const formatUpdatedAt = (value: string) => {
  const date = new Date(value)
  return `更新于 ${date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
}
</script>

<template>
  <div
    class="queue-app"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <aside class="queue-sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-brand">
        <div class="simple-logo"><span></span><span></span><span></span></div>
        <div><strong>Planflow</strong><small>文件任务队列</small></div>
        <button class="sidebar-close" type="button" aria-label="关闭队列列表" @click="sidebarOpen = false">
          <BaseIcon name="close" :size="18" />
        </button>
      </div>

      <div class="sidebar-actions">
        <button class="import-button" type="button" :disabled="isImporting" @click="openFilePicker">
          <span :class="{ spinning: isImporting }"><BaseIcon :name="isImporting ? 'refresh' : 'upload'" :size="17" /></span>
          {{ isImporting ? '正在导入…' : '导入计划文件' }}
        </button>
        <button class="new-queue-button" type="button" title="新建空队列" @click="openNewQueue">
          <BaseIcon name="plus" :size="18" />
        </button>
      </div>

      <label class="sidebar-search">
        <BaseIcon name="search" :size="16" />
        <input v-model="queueSearch" type="search" placeholder="搜索文件队列" />
        <button v-if="queueSearch" type="button" aria-label="清空搜索" @click="queueSearch = ''"><BaseIcon name="close" :size="13" /></button>
      </label>

      <div class="queue-summary">
        <span>文件队列 <b>{{ queues.length }}</b></span>
        <span>{{ queueCompletedCount }}/{{ queueTaskCount }} 已完成</span>
      </div>

      <div class="queue-list">
        <div v-for="queue in visibleQueues" :key="queue.id" class="queue-list-item" :class="{ active: selectedQueueId === queue.id }">
          <button class="queue-select" type="button" @click="selectQueue(queue.id)">
            <span class="queue-file-icon" :class="`type-${queue.type}`"><BaseIcon name="file" :size="17" /></span>
            <span class="queue-copy">
              <strong>{{ queue.name }}</strong>
              <small>{{ queue.tasks.filter((task) => task.completed).length }}/{{ queue.tasks.length }} 项 · {{ queue.type }}</small>
              <i><em :style="{ width: `${queueProgress(queue)}%` }"></em></i>
            </span>
            <BaseIcon name="chevron-right" :size="15" />
          </button>
          <button class="queue-remove" type="button" :aria-label="`删除队列 ${queue.name}`" @click="requestDeleteQueue(queue)">
            <BaseIcon name="trash" :size="15" />
          </button>
        </div>

        <div v-if="queues.length && !visibleQueues.length" class="sidebar-empty">
          <BaseIcon name="search" :size="22" />
          <span>没有匹配的队列</span>
        </div>

        <button v-if="!queues.length" class="first-import" type="button" @click="openFilePicker">
          <span><BaseIcon name="folder" :size="25" /></span>
          <strong>还没有任务队列</strong>
          <small>上传一个或多个 Markdown 文件</small>
        </button>
      </div>

      <div class="sidebar-foot">
        <span class="storage-dot"></span>
        数据只保存在当前浏览器
      </div>
    </aside>

    <button v-if="sidebarOpen" class="sidebar-mask" type="button" aria-label="关闭队列列表" @click="sidebarOpen = false"></button>

    <main class="queue-main">
      <template v-if="selectedQueue">
        <header class="queue-header">
          <div class="queue-heading">
            <button class="mobile-sidebar-trigger" type="button" aria-label="打开队列列表" @click="sidebarOpen = true">
              <BaseIcon name="menu" :size="19" />
            </button>
            <span class="header-file-icon" :class="`type-${selectedQueue.type}`"><BaseIcon name="file" :size="20" /></span>
            <div>
              <div class="queue-title-line">
                <h1>{{ selectedQueue.name }}</h1>
                <span :class="`type-${selectedQueue.type}`">{{ selectedQueue.type }}</span>
              </div>
              <p>{{ selectedQueue.sourceName }} · {{ formatUpdatedAt(selectedQueue.updatedAt) }}</p>
            </div>
          </div>
          <div class="header-actions">
            <button class="text-button" type="button" @click="readerOpen = true"><BaseIcon name="file" :size="16" />预览原文</button>
            <button class="text-button" type="button" @click="exportQueue"><BaseIcon name="download" :size="16" />导出</button>

            <button class="text-button" type="button" @click="openEditQueue"><BaseIcon name="edit" :size="16" />编辑队列</button>
            <button class="add-task-button" type="button" @click="openNewTask"><BaseIcon name="plus" :size="17" />添加任务</button>
          </div>
        </header>

        <div class="main-content">
          <section v-if="focusedHourTask" class="motivation-banner" :class="{ completed: focusedHourTask.completed }">
            <div class="motivation-spark"><BaseIcon name="spark" :size="28" :stroke-width="2.2" /></div>
            <div class="motivation-copy">
              <span>{{ focusedHourTask.time }} · 本小时能量</span>
              <strong>{{ motivationForTask(focusedHourTask) }}</strong>
              <p>{{ focusedHourTask.completed ? '这一小时已经漂亮拿下，带着这股力量继续前进！' : `当前目标：${focusedHourTask.title}` }}</p>
            </div>
          </section>

          <section class="queue-hero">
            <p class="hero-kicker"><i></i>{{ selectedQueue.type }} · TASK QUEUE</p>
            <p>把要做的事情写下来，然后一件件完成。</p>
          </section>

          <section class="progress-panel">
            <div class="progress-number">
              <strong>{{ selectedProgress }}%</strong>
              <span>完成进度</span>
            </div>
            <div class="progress-main">
              <div class="progress-labels">
                <span><b>{{ selectedCompleted }}</b> 已完成</span>
                <span><b>{{ selectedTotal - selectedCompleted }}</b> 待完成</span>
              </div>
              <div class="main-progress"><span :style="{ width: `${selectedProgress}%` }"></span></div>
            </div>
            <p>{{ selectedQueue.importMessage }}</p>
          </section>

          <form class="quick-add-bar" @submit.prevent="quickAddTask">
            <BaseIcon name="plus" :size="19" />
            <input v-model="quickTaskTitle" maxlength="240" placeholder="添加一项新任务…" />
            <button type="submit" :disabled="!quickTaskTitle.trim()">添加任务</button>
          </form>

          <section class="tasks-section">
            <div class="tasks-toolbar">
              <div class="filter-tabs">
                <button type="button" :class="{ active: taskFilter === 'all' }" @click="taskFilter = 'all'">全部 <span>{{ taskFilterCounts.all }}</span></button>
                <button type="button" :class="{ active: taskFilter === 'todo' }" @click="taskFilter = 'todo'">待完成 <span>{{ taskFilterCounts.todo }}</span></button>
                <button type="button" :class="{ active: taskFilter === 'done' }" @click="taskFilter = 'done'">已完成 <span>{{ taskFilterCounts.done }}</span></button>
              </div>
              <label class="task-search">
                <BaseIcon name="search" :size="16" />
                <input v-model="taskSearch" type="search" placeholder="搜索当前队列" />
                <button v-if="taskSearch" type="button" aria-label="清空搜索" @click="taskSearch = ''"><BaseIcon name="close" :size="13" /></button>
              </label>
            </div>
            <div class="expand-hint"><BaseIcon name="chevron-down" :size="13" />点击任务行，查看这一小时的具体内容</div>

            <div v-if="filteredTasks.length" class="task-list">
              <article
                v-for="task in filteredTasks"
                :key="task.id"
                class="simple-task"
                :class="{ completed: task.completed, changed: changedTaskId === task.id, 'hour-task': isHourTask(task) }"
                tabindex="0"
                role="button"
                :aria-expanded="expandedTaskId === task.id"
                @click="toggleExpanded(task.id)"
                @keydown.enter.prevent="toggleExpanded(task.id)"
              >
                <div class="task-row-shell">
                  <button class="complete-button" type="button" :aria-label="task.completed ? '恢复为待完成' : '标记为已完成'" @click.stop="toggleTask(task)">
                    <BaseIcon v-if="task.completed" name="check" :size="15" :stroke-width="2.5" />
                  </button>
                  <time :class="{ empty: !task.time }">{{ task.time || '待安排' }}</time>
                  <div class="simple-task-copy">
                    <strong>{{ task.title }} <span class="expand-indicator" :class="{ open: expandedTaskId === task.id }"><BaseIcon name="chevron-down" :size="14" /></span></strong>
                    <p v-if="isHourTask(task)" class="task-motivation"><BaseIcon name="spark" :size="14" />{{ motivationForTask(task) }}</p>
                    <p v-if="task.note">{{ task.note }}</p>
                  </div>
                  <div class="task-row-actions">
                    <button type="button" :aria-label="`编辑任务 ${task.title}`" @click.stop="openEditTask(task)"><BaseIcon name="edit" :size="16" /></button>
                    <button class="delete-action" type="button" :aria-label="`删除任务 ${task.title}`" @click.stop="requestDeleteTask(task)"><BaseIcon name="trash" :size="16" /></button>
                  </div>
                </div>
                <div v-if="expandedTaskId === task.id" class="task-details" @click.stop>
                  <div class="details-heading">
                    <span><BaseIcon name="clock" :size="14" />{{ task.time || '待安排' }} · 这一小时</span>
                    <button type="button" @click.stop="toggleExpanded(task.id)">收起 <BaseIcon name="chevron-down" :size="13" /></button>
                  </div>
                  <div class="details-grid">
                    <div>
                      <span>要完成什么</span>
                      <p>{{ task.title }}</p>
                    </div>
                    <div>
                      <span>具体内容</span>
                      <ul v-if="task.details.length">
                        <li v-for="detail in task.details" :key="detail">{{ detail }}</li>
                      </ul>
                      <p v-else class="detail-placeholder">文件里没有提供更细步骤，可以点右侧编辑按钮补充。</p>
                    </div>
                  </div>
                  <div v-if="task.note" class="detail-source"><BaseIcon name="file" :size="13" />来源段落：{{ task.note }}</div>
                  <div v-if="repeatLabelForTask(task)" class="detail-source">
                    <span class="template-badge"><BaseIcon name="refresh" :size="12" />每日重复 · {{ repeatLabelForTask(task) }}</span>
                    <button type="button" class="detail-edit-button" style="color:#c7785d;margin-left:auto" @click.stop="stopRepeat(task)"><BaseIcon name="trash" :size="13" />停止重复</button>
                  </div>
                  <button class="detail-edit-button" type="button" @click.stop="openEditTask(task)"><BaseIcon name="edit" :size="14" />补充具体内容</button>
                </div>
              </article>
            </div>

            <div v-else class="task-empty">
              <div><BaseIcon :name="selectedQueue.tasks.length ? 'search' : 'check'" :size="29" /></div>
              <h2>{{ selectedQueue.tasks.length ? '没有匹配的任务' : '这个队列还没有任务' }}</h2>
              <p>{{ selectedQueue.tasks.length ? '换一个筛选条件或搜索词试试。' : '解析器没有把正文段落误当任务，你可以手动添加。' }}</p>
              <button v-if="!selectedQueue.tasks.length" class="add-task-button" type="button" @click="openNewTask"><BaseIcon name="plus" :size="16" />添加第一个任务</button>
            </div>
          </section>
        </div>
      </template>

      <div v-else class="welcome-empty">
        <button class="mobile-sidebar-trigger welcome-menu" type="button" aria-label="打开队列列表" @click="sidebarOpen = true"><BaseIcon name="menu" :size="19" /></button>
        <div class="welcome-icon"><BaseIcon name="folder" :size="36" /></div>
        <span>FILE → QUEUE</span>
        <h1>一个文件，一个任务队列</h1>
        <p>上传 80 个计划文件，就得到 80 个相互独立的队列。普通正文不会再被误识别成任务。</p>
        <div class="welcome-actions">
          <button class="add-task-button" type="button" :disabled="isImporting" @click="openFilePicker"><BaseIcon name="upload" :size="17" />{{ isImporting ? '正在导入…' : '选择计划文件' }}</button>
          <button class="text-button" type="button" @click="openNewQueue"><BaseIcon name="plus" :size="16" />新建空队列</button>
        </div>
        <small>支持 .md、.markdown、.txt，可多选或直接拖入</small>
      </div>

      <input ref="fileInput" class="visually-hidden" type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" multiple @change="onFileInput" />
    </main>

    <Transition name="fade">
      <div v-if="isDragging" class="drop-layer">
        <div><BaseIcon name="upload" :size="34" /><h2>松开即可导入</h2><p>每个文件会创建一个独立队列</p></div>
      </div>
    </Transition>

    <Transition name="modal">
      <div v-if="modalMode" class="modal-layer" @mousedown.self="modalMode = null">
        <form v-if="modalMode === 'task'" class="simple-modal" @submit.prevent="saveTask">
          <div class="modal-title">
            <div><span>{{ editingTaskId ? 'EDIT TASK' : 'NEW TASK' }}</span><h2>{{ editingTaskId ? '编辑任务' : '添加任务' }}</h2></div>
            <button type="button" aria-label="关闭" @click="modalMode = null"><BaseIcon name="close" :size="18" /></button>
          </div>
          <label><span>任务内容</span><input v-model="taskDraft.title" autofocus maxlength="240" placeholder="要完成什么？" /></label>
          <label><span>时间（可选）</span><input v-model="taskDraft.time" maxlength="20" placeholder="例如：08:30" /></label>
          <label><span>备注（可选）</span><textarea v-model="taskDraft.note" rows="3" maxlength="300" placeholder="补充说明、材料或目标"></textarea></label>
          <label><span>具体内容（每行一条）</span><textarea v-model="taskDraft.details" rows="6" maxlength="3000" placeholder="例如：\n1. 先看第 3 节视频\n2. 完成课后练习\n3. 记录 3 个疑问"></textarea></label>
          <label><span>重复（每日计划）</span>
            <select v-model="taskDraft.repeat">
              <option value="none">不重复（普通任务）</option>
              <option value="daily">每天</option>
              <option value="weekly">每周指定</option>
            </select>
          </label>
          <div v-if="taskDraft.repeat === 'weekly'" class="repeat-weekdays">
            <button
              v-for="option in weekdayOptions"
              :key="option.value"
              type="button"
              :class="{ active: taskDraft.weekdays.includes(option.value) }"
              @click="toggleWeekday(option.value)"
            >{{ option.label }}</button>
          </div>
          <p v-if="taskDraft.repeat !== 'none'" class="repeat-hint">到了对应日期会自动加入「每日计划」队列，每天生成一条独立任务，完成情况互不影响。</p>
          <div class="modal-buttons"><button class="cancel-button" type="button" @click="modalMode = null">取消</button><button class="save-button" type="submit" :disabled="!taskDraft.title.trim() || (taskDraft.repeat === 'weekly' && !taskDraft.weekdays.length)"><BaseIcon name="check" :size="16" />{{ editingTaskId ? '保存修改' : '添加任务' }}</button></div>
        </form>

        <form v-else class="simple-modal" @submit.prevent="saveQueue">
          <div class="modal-title">
            <div><span>{{ editingQueueId ? 'EDIT QUEUE' : 'NEW QUEUE' }}</span><h2>{{ editingQueueId ? '编辑队列' : '新建空队列' }}</h2></div>
            <button type="button" aria-label="关闭" @click="modalMode = null"><BaseIcon name="close" :size="18" /></button>
          </div>
          <label><span>队列名称</span><input v-model="queueDraft.name" autofocus maxlength="80" placeholder="例如：英语学习计划" /></label>
          <label><span>队列类型</span><select v-model="queueDraft.type"><option v-for="type in queueTypes" :key="type" :value="type">{{ type }}</option></select></label>
          <div class="modal-buttons"><button class="cancel-button" type="button" @click="modalMode = null">取消</button><button class="save-button" type="submit" :disabled="!queueDraft.name.trim()"><BaseIcon name="check" :size="16" />{{ editingQueueId ? '保存队列' : '创建队列' }}</button></div>
        </form>
      </div>
    </Transition>

    <Transition name="modal">
      <div v-if="confirmTarget" class="modal-layer" @mousedown.self="confirmTarget = null">
        <div class="confirm-modal">
          <div class="confirm-icon"><BaseIcon name="trash" :size="21" /></div>
          <h2>确定删除{{ confirmTarget.kind === 'queue' ? '这个队列' : '这个任务' }}吗？</h2>
          <p>“{{ confirmTarget.name }}”{{ confirmTarget.kind === 'queue' ? '及其中的全部任务' : '' }}将从本地记录中移除。</p>
          <div class="modal-buttons"><button class="cancel-button" type="button" @click="confirmTarget = null">取消</button><button class="danger-button" type="button" @click="confirmDelete">确认删除</button></div>
        </div>
      </div>
    </Transition>

    <Transition name="reader">
      <ReaderOverlay
        v-if="readerOpen && selectedQueue"
        :queue-id="selectedQueue.id"
        :title="selectedQueue.name"
        :source="selectedQueue.rawContent ?? ''"
        @close="readerOpen = false"
      />
    </Transition>

    <Transition name="toast">
      <div v-if="toast.visible" class="action-toast" :class="toast.tone">

        <span><BaseIcon :name="toast.tone === 'success' ? 'check' : 'inbox'" :size="16" /></span>
        <div><strong>{{ toast.title }}</strong><small>{{ toast.detail }}</small></div>
        <button type="button" aria-label="关闭提示" @click="toast.visible = false"><BaseIcon name="close" :size="14" /></button>
      </div>
    </Transition>
  </div>
</template>
