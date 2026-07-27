<script setup lang="ts">
/**
 * ReaderOverlay —— 队列级 Markdown 全屏阅读器。
 *
 * 功能：
 *  - 将队列原始 Markdown 渲染成排版好的富文本（marked + DOMPurify）
 *  - 四档护眼主题（纸白 / 护眼绿 / 羊皮纸黄 / 夜间黑）+ 字号调节
 *  - 按队列记忆上次滚动百分比，重新打开自动回到原位
 *  - 主题 / 字号偏好全局持久化；Esc 关闭
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BaseIcon from './BaseIcon.vue'
import { renderMarkdown } from '../utils/renderMarkdown'


const props = defineProps<{
  queueId: string
  title: string
  source: string
}>()

const emit = defineEmits<{ (event: 'close'): void }>()

type ReaderTheme = 'paper' | 'sage' | 'sepia' | 'night'
const themes: { key: ReaderTheme; label: string }[] = [
  { key: 'paper', label: '纸白' },
  { key: 'sage', label: '护眼绿' },
  { key: 'sepia', label: '羊皮纸' },
  { key: 'night', label: '夜间' },
]

const PREFS_KEY = 'planflow.reader.prefs'
const PROGRESS_KEY = 'planflow.reader.progress'
const MIN_FONT = 15
const MAX_FONT = 26

const theme = ref<ReaderTheme>('paper')
const fontSize = ref(18)
const scroller = ref<HTMLElement | null>(null)

const html = computed(() => renderMarkdown(props.source))
const hasContent = computed(() => Boolean(props.source && props.source.trim()))

const readAllProgress = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

const loadPrefs = () => {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return
    const prefs = JSON.parse(raw) as { theme?: ReaderTheme; fontSize?: number }
    if (prefs.theme && themes.some((item) => item.key === prefs.theme)) theme.value = prefs.theme
    if (typeof prefs.fontSize === 'number') fontSize.value = Math.min(MAX_FONT, Math.max(MIN_FONT, prefs.fontSize))
  } catch {
    /* 偏好读取失败时保持默认值 */
  }
}

const savePrefs = () => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ theme: theme.value, fontSize: fontSize.value }))
  } catch {
    /* 忽略存储异常 */
  }
}

const saveProgress = (percent: number) => {
  try {
    const all = readAllProgress()
    all[props.queueId] = Number(percent.toFixed(4))
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all))
  } catch {
    /* 忽略存储异常 */
  }
}

const restoreProgress = () => {
  const el = scroller.value
  if (!el) return
  const percent = readAllProgress()[props.queueId] ?? 0
  const max = el.scrollHeight - el.clientHeight
  el.scrollTop = max > 0 ? max * percent : 0
}

let scrollRaf = 0
const onScroll = () => {
  if (scrollRaf) return
  scrollRaf = window.requestAnimationFrame(() => {
    scrollRaf = 0
    const el = scroller.value
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    saveProgress(max > 0 ? el.scrollTop / max : 0)
  })
}

const changeFont = (delta: number) => {
  fontSize.value = Math.min(MAX_FONT, Math.max(MIN_FONT, fontSize.value + delta))
}

const close = () => emit('close')

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') close()
}

watch([theme, fontSize], savePrefs)
// 内容变化（切换到别的队列）时，等 DOM 更新后恢复该队列的阅读位置。
watch(
  () => props.queueId,
  async () => {
    await nextTick()
    restoreProgress()
  },
)

onMounted(async () => {
  loadPrefs()
  window.addEventListener('keydown', onKeydown)
  await nextTick()
  restoreProgress()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (scrollRaf) window.cancelAnimationFrame(scrollRaf)
})
</script>

<template>
  <div class="reader-overlay" :class="`reader-theme-${theme}`">
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
      </div>
    </header>

    <div ref="scroller" class="reader-scroll" @scroll.passive="onScroll">
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
  </div>
</template>
