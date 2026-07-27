<script setup lang="ts">
/**
 * ReaderOverlay —— 队列级 Markdown 全屏阅读器（左右分栏 + 小记模式）。
 *
 * 左侧：原文 Markdown 富文本预览 + 回到顶部按钮。
 * 右侧：小记。顶部「预览 / 笔记」切换 —— 默认「预览」（渲染只读），
 *       点「笔记」进入编辑态（textarea 自由输入）+ 回到顶部按钮。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BaseIcon from './BaseIcon.vue'
import { renderMarkdown } from '../utils/renderMarkdown'
import { formatNote, noteFileName } from '../utils/noteFormat'

const props = defineProps<{
  queueId: string
  title: string
  source: string
}>()

const emit = defineEmits<{ (event: 'close'): void }>()

// ─── 主题 / 字号 ────────────────────────────────────────────────────────────
type ReaderTheme = 'paper' | 'sage' | 'sepia' | 'night'
const themes: { key: ReaderTheme; label: string }[] = [
  { key: 'paper', label: '纸白' },
  { key: 'sage', label: '护眼绿' },
  { key: 'sepia', label: '羊皮纸' },
  { key: 'night', label: '夜间' },
]

const PREFS_KEY = 'planflow.reader.prefs'
const PROGRESS_KEY = 'planflow.reader.progress'
const NOTES_KEY = 'planflow.notes.v1'
const MIN_FONT = 15
const MAX_FONT = 26
const AUTO_SAVE_MS = 5 * 60 * 1000
const BACK_TOP_THRESHOLD = 200

const theme = ref<ReaderTheme>('paper')
const fontSize = ref(18)

// ─── 笔记模式：预览（默认）/ 编辑 ────────────────────────────────────────────
const noteMode = ref<'preview' | 'edit'>('preview')

// ─── DOM refs ────────────────────────────────────────────────────────────────
const leftScroller = ref<HTMLElement | null>(null)
const noteArea = ref<HTMLTextAreaElement | null>(null)
const notePreview = ref<HTMLElement | null>(null)
const container = ref<HTMLElement | null>(null)

// 当前右侧滚动元素（随模式切换）
const rightScrollEl = (): HTMLElement | null =>
  noteMode.value === 'edit' ? noteArea.value : notePreview.value

// ─── 回到顶部可见性 ──────────────────────────────────────────────────────────
const leftScrolled = ref(false)
const rightScrolled = ref(false)

const scrollLeftTop = () => { leftScroller.value?.scrollTo({ top: 0 }) }
const scrollRightTop = () => { rightScrollEl()?.scrollTo({ top: 0 }) }

// ─── 布局：拖拽分割线 ────────────────────────────────────────────────────────
const leftPercent = ref(50)
const MIN_SIDE_PX = 280

let isDragging = false
let dragStartX = 0
let dragStartPercent = 0

const onDividerMousedown = (e: MouseEvent) => {
  isDragging = true
  dragStartX = e.clientX
  dragStartPercent = leftPercent.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const onMousemove = (e: MouseEvent) => {
  if (!isDragging || !container.value) return
  const totalW = container.value.clientWidth
  const delta = e.clientX - dragStartX
  const minPercent = (MIN_SIDE_PX / totalW) * 100
  const maxPercent = 100 - minPercent
  leftPercent.value = Math.min(maxPercent, Math.max(minPercent, dragStartPercent + (delta / totalW) * 100))
}

const onMouseup = () => {
  if (!isDragging) return
  isDragging = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// ─── 同步滚动 ────────────────────────────────────────────────────────────────
const syncScroll = ref(true)
let syncingFrom: 'left' | 'note' | null = null
let syncRaf = 0

const doSyncFromLeft = () => {
  syncRaf = 0
  if (!syncScroll.value || syncingFrom !== 'left') { syncingFrom = null; return }
  const left = leftScroller.value
  const right = rightScrollEl()
  if (!left || !right) { syncingFrom = null; return }
  const leftMax = left.scrollHeight - left.clientHeight
  const rightMax = right.scrollHeight - right.clientHeight
  if (leftMax <= 0 || rightMax <= 0) { syncingFrom = null; return }
  right.scrollTop = (left.scrollTop / leftMax) * rightMax
  syncingFrom = null
}

const doSyncFromNote = () => {
  syncRaf = 0
  if (!syncScroll.value || syncingFrom !== 'note') { syncingFrom = null; return }
  const left = leftScroller.value
  const right = rightScrollEl()
  if (!left || !right) { syncingFrom = null; return }
  const leftMax = left.scrollHeight - left.clientHeight
  const rightMax = right.scrollHeight - right.clientHeight
  if (leftMax <= 0 || rightMax <= 0) { syncingFrom = null; return }
  left.scrollTop = (right.scrollTop / rightMax) * leftMax
  syncingFrom = null
}

const onLeftScroll = () => {
  const el = leftScroller.value
  if (el) {
    leftScrolled.value = el.scrollTop > BACK_TOP_THRESHOLD
    const max = el.scrollHeight - el.clientHeight
    saveProgress(max > 0 ? el.scrollTop / max : 0)
  }
  if (syncingFrom === 'note') return
  if (syncRaf) cancelAnimationFrame(syncRaf)
  syncingFrom = 'left'
  syncRaf = requestAnimationFrame(doSyncFromLeft)
}

const onRightScroll = () => {
  const el = rightScrollEl()
  if (el) rightScrolled.value = el.scrollTop > BACK_TOP_THRESHOLD
  if (syncingFrom === 'left') return
  if (syncRaf) cancelAnimationFrame(syncRaf)
  syncingFrom = 'note'
  syncRaf = requestAnimationFrame(doSyncFromNote)
}

// ─── 阅读进度 ────────────────────────────────────────────────────────────────
const readAllProgress = (): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}') } catch { return {} }
}

const saveProgress = (percent: number) => {
  try {
    const all = readAllProgress()
    all[props.queueId] = Number(percent.toFixed(4))
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all))
  } catch { /* ignore */ }
}

const restoreProgress = () => {
  const el = leftScroller.value
  if (!el) return
  const pct = readAllProgress()[props.queueId] ?? 0
  const max = el.scrollHeight - el.clientHeight
  el.scrollTop = max > 0 ? max * pct : 0
}

// ─── 笔记存储 ────────────────────────────────────────────────────────────────
type NoteRecord = { content: string; cursorPos: number; savedAt: number }

const readAllNotes = (): Record<string, NoteRecord> => {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}') } catch { return {} }
}

const noteContent = ref('')
const noteDirty = ref(false)

const saveNote = () => {
  if (!noteDirty.value) return
  try {
    const all = readAllNotes()
    all[props.queueId] = {
      content: noteContent.value,
      cursorPos: noteArea.value?.selectionStart ?? 0,
      savedAt: Date.now(),
    }
    localStorage.setItem(NOTES_KEY, JSON.stringify(all))
    noteDirty.value = false
  } catch { /* ignore */ }
}

const loadNote = () => {
  const rec = readAllNotes()[props.queueId]
  noteContent.value = rec?.content ?? ''
  noteDirty.value = false
  nextTick(() => {
    if (noteArea.value && rec?.cursorPos != null) {
      noteArea.value.selectionStart = rec.cursorPos
      noteArea.value.selectionEnd = rec.cursorPos
    }
  })
}

const onNoteInput = () => { noteDirty.value = true }

// ─── 5 分钟自动保存 ──────────────────────────────────────────────────────────
let autoSaveTimer: ReturnType<typeof setInterval> | null = null

const startAutoSave = () => {
  if (autoSaveTimer) return
  autoSaveTimer = setInterval(saveNote, AUTO_SAVE_MS)
}

const stopAutoSave = () => {
  if (!autoSaveTimer) return
  clearInterval(autoSaveTimer)
  autoSaveTimer = null
}

// ─── 偏好 ────────────────────────────────────────────────────────────────────
const loadPrefs = () => {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return
    const prefs = JSON.parse(raw) as { theme?: ReaderTheme; fontSize?: number }
    if (prefs.theme && themes.some((t) => t.key === prefs.theme)) theme.value = prefs.theme
    if (typeof prefs.fontSize === 'number') fontSize.value = Math.min(MAX_FONT, Math.max(MIN_FONT, prefs.fontSize))
  } catch { /* ignore */ }
}

const savePrefs = () => {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ theme: theme.value, fontSize: fontSize.value })) } catch { /* ignore */ }
}

const changeFont = (delta: number) => {
  fontSize.value = Math.min(MAX_FONT, Math.max(MIN_FONT, fontSize.value + delta))
}

// ─── 导出笔记 ────────────────────────────────────────────────────────────────
const exportNote = () => {
  const content = formatNote(noteContent.value)
  if (!content) return
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = noteFileName(props.title)
  a.click()
  URL.revokeObjectURL(url)
}

// ─── 关闭 ────────────────────────────────────────────────────────────────────
const close = () => {
  saveNote()
  emit('close')
}

const onKeydown = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
const onBeforeUnload = () => { saveNote() }

// ─── 渲染 ────────────────────────────────────────────────────────────────────
const html = computed(() => renderMarkdown(props.source))
const noteHtml = computed(() => renderMarkdown(noteContent.value))
const hasContent = computed(() => Boolean(props.source?.trim()))

// ─── 生命周期 ────────────────────────────────────────────────────────────────
watch([theme, fontSize], savePrefs)

watch(
  () => props.queueId,
  async () => {
    saveNote()
    await nextTick()
    loadNote()
    restoreProgress()
  },
)

onMounted(async () => {
  loadPrefs()
  loadNote()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('beforeunload', onBeforeUnload)
  window.addEventListener('mousemove', onMousemove)
  window.addEventListener('mouseup', onMouseup)
  await nextTick()
  restoreProgress()
})

onBeforeUnmount(() => {
  saveNote()
  stopAutoSave()
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('beforeunload', onBeforeUnload)
  window.removeEventListener('mousemove', onMousemove)
  window.removeEventListener('mouseup', onMouseup)
  if (syncRaf) cancelAnimationFrame(syncRaf)
})
</script>

<template>
  <div class="reader-overlay" :class="`reader-theme-${theme}`">
    <!-- 顶部工具栏 -->
    <header class="reader-bar">
      <div class="reader-bar-left">
        <button class="reader-close" type="button" aria-label="关闭阅读" @click="close">
          <BaseIcon name="close" :size="18" />
        </button>
        <div class="reader-heading">
          <span>阅读预览</span>
          <strong>{{ title }}</strong>
        </div>
      </div>

      <div class="reader-tools">
        <div class="reader-theme-switch" role="group" aria-label="护眼主题">
          <button
            v-for="item in themes"
            :key="item.key"
            type="button"
            :class="{ active: theme === item.key }"
            :aria-pressed="theme === item.key"
            @click="theme = item.key"
          >
            <i :class="`swatch-${item.key}`"></i>{{ item.label }}
          </button>
        </div>
        <div class="reader-font" role="group" aria-label="字号调节">
          <button type="button" aria-label="缩小字号" :disabled="fontSize <= MIN_FONT" @click="changeFont(-1)">A－</button>
          <span>{{ fontSize }}</span>
          <button type="button" aria-label="放大字号" :disabled="fontSize >= MAX_FONT" @click="changeFont(1)">A＋</button>
        </div>
        <button
          class="reader-sync-btn"
          type="button"
          :class="{ active: syncScroll }"
          :title="syncScroll ? '同步滚动（点击切换为独立滚动）' : '独立滚动（点击切换为同步滚动）'"
          @click="syncScroll = !syncScroll"
        >
          <BaseIcon :name="syncScroll ? 'link' : 'unlink'" :size="15" />
          {{ syncScroll ? '同步' : '独立' }}
        </button>
        <button
          class="reader-export-btn"
          type="button"
          :disabled="!noteContent.trim()"
          title="导出笔记为 .md 文件"
          @click="exportNote"
        >
          <BaseIcon name="download" :size="15" />导出笔记
        </button>
      </div>
    </header>

    <!-- 左右分栏主体 -->
    <div ref="container" class="reader-body">
      <!-- 左侧：预览 -->
      <div
        class="reader-pane-wrap"
        :style="{ width: `${leftPercent}%` }"
      >
        <div
          ref="leftScroller"
          class="reader-pane reader-pane-left"
          @scroll.passive="onLeftScroll"
        >
          <article
            v-if="hasContent"
            class="reader-prose"
            :style="{ fontSize: `${fontSize}px` }"
            v-html="html"
          ></article>
          <div v-else class="reader-empty">
            <BaseIcon name="file" :size="30" />
            <h2>没有可预览的原始文件</h2>
            <p>这个队列是手动创建的，或来自旧版本数据。重新导入对应的 Markdown 文件即可在这里阅读原文。</p>
          </div>
        </div>
        <!-- 左侧回到顶部 -->
        <button
          v-show="leftScrolled"
          class="back-top"
          type="button"
          title="回到顶部"
          @click="scrollLeftTop"
        >
          <BaseIcon name="arrow-up" :size="16" />
        </button>
      </div>

      <!-- 中间：拖拽分割线 -->
      <div
        class="reader-divider"
        title="拖拽调整宽度"
        @mousedown.prevent="onDividerMousedown"
      >
        <span class="reader-divider-handle"></span>
      </div>

      <!-- 右侧：笔记区 -->
      <div
        class="reader-pane-wrap"
        :style="{ width: `${100 - leftPercent}%` }"
        @mouseenter="startAutoSave"
        @mouseleave="stopAutoSave"
      >
        <!-- 右侧顶部：预览/笔记切换 + 保存状态 + 导出 -->
        <div class="note-header">
          <!-- 预览 / 笔记 切换 -->
          <div class="note-mode-switch" role="group" aria-label="笔记模式">
            <button
              type="button"
              :class="{ active: noteMode === 'preview' }"
              @click="noteMode = 'preview'"
            >
              <BaseIcon name="file" :size="13" />预览
            </button>
            <button
              type="button"
              :class="{ active: noteMode === 'edit' }"
              @click="noteMode = 'edit'"
            >
              <BaseIcon name="edit" :size="13" />笔记
            </button>
          </div>
          <span v-if="noteDirty" class="note-unsaved">未保存</span>
          <button class="note-save-btn" type="button" title="立即保存" @click="saveNote">
            <BaseIcon name="save" :size="14" />
          </button>
        </div>

        <!-- 右侧内容区 -->
        <div class="note-body">
          <!-- 编辑态 -->
          <textarea
            v-show="noteMode === 'edit'"
            ref="noteArea"
            v-model="noteContent"
            class="note-textarea"
            :style="{ fontSize: `${fontSize}px`, lineHeight: '2' }"
            placeholder="随手记录你的想法、理解、疑问……"
            spellcheck="false"
            @input="onNoteInput"
            @scroll.passive="onRightScroll"
          ></textarea>

          <!-- 预览态 -->
          <div
            v-show="noteMode === 'preview'"
            ref="notePreview"
            class="note-preview-pane"
            @scroll.passive="onRightScroll"
          >
            <article
              v-if="noteContent.trim()"
              class="reader-prose note-prose"
              :style="{ fontSize: `${fontSize}px` }"
              v-html="noteHtml"
            ></article>
            <div v-else class="note-empty">
              <BaseIcon name="edit" :size="28" />
              <h2>还没有笔记</h2>
              <p>点击上方「笔记」进入编辑，随手记录想法与理解。</p>
              <button class="note-empty-btn" type="button" @click="noteMode = 'edit'">
                <BaseIcon name="edit" :size="14" />开始写笔记
              </button>
            </div>
          </div>
        </div>

        <!-- 右侧回到顶部 -->
        <button
          v-show="rightScrolled"
          class="back-top"
          type="button"
          title="回到顶部"
          @click="scrollRightTop"
        >
          <BaseIcon name="arrow-up" :size="16" />
        </button>
      </div>
    </div>
  </div>
</template>
