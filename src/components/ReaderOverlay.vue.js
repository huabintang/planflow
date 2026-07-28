import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import BaseIcon from './BaseIcon.vue';
import { renderMarkdown } from '../utils/renderMarkdown';
import { formatNote, noteFileName } from '../utils/noteFormat';
import { computeBlankLineInsertion } from '../utils/noteCaret';
const props = defineProps();
const emit = defineEmits();
const themes = [
    { key: 'paper', label: '纸白' },
    { key: 'sage', label: '护眼绿' },
    { key: 'sepia', label: '羊皮纸' },
    { key: 'night', label: '夜间' },
];
const PREFS_KEY = 'planflow.reader.prefs';
const PROGRESS_KEY = 'planflow.reader.progress';
const NOTES_KEY = 'planflow.notes.v1';
const MIN_FONT = 15;
const MAX_FONT = 26;
const AUTO_SAVE_MS = 5 * 60 * 1000;
const BACK_TOP_THRESHOLD = 200;
const theme = ref('paper');
const fontSize = ref(18);
// ─── 笔记模式：预览（默认）/ 编辑 ────────────────────────────────────────────
const noteMode = ref('preview');
// ─── DOM refs ────────────────────────────────────────────────────────────────
const leftScroller = ref(null);
const noteEditor = ref(null);
const noteScroller = ref(null);
const container = ref(null);
// 右侧统一滚动元素（编辑 / 预览共用同一个滚动容器 note-body）
const rightScrollEl = () => noteScroller.value;
// ─── 回到顶部可见性 ──────────────────────────────────────────────────────────
const leftScrolled = ref(false);
const rightScrolled = ref(false);
// ─── 右侧内容最小高度 ────────────────────────────────────────────────────────
// 让右侧笔记区（编辑 / 预览）至少与左侧原文一样高，
// 这样两侧滚动范围一致、滚动条等长，同步滚动才能一一对应。
const contentMinHeight = ref(0);
let leftResizeObserver = null;
const syncContentHeight = () => {
    const el = leftScroller.value;
    if (!el)
        return;
    // 取左侧内容实际高度与视口高度的较大值
    contentMinHeight.value = Math.max(el.scrollHeight, el.clientHeight);
};
const scrollLeftTop = () => { leftScroller.value?.scrollTo({ top: 0 }); };
const scrollRightTop = () => { rightScrollEl()?.scrollTo({ top: 0 }); };
// ─── 布局：拖拽分割线 ────────────────────────────────────────────────────────
const leftPercent = ref(50);
const MIN_SIDE_PX = 280;
let isDragging = false;
let dragStartX = 0;
let dragStartPercent = 0;
const onDividerMousedown = (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartPercent = leftPercent.value;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
};
const onMousemove = (e) => {
    if (!isDragging || !container.value)
        return;
    const totalW = container.value.clientWidth;
    const delta = e.clientX - dragStartX;
    const minPercent = (MIN_SIDE_PX / totalW) * 100;
    const maxPercent = 100 - minPercent;
    leftPercent.value = Math.min(maxPercent, Math.max(minPercent, dragStartPercent + (delta / totalW) * 100));
};
const onMouseup = () => {
    if (!isDragging)
        return;
    isDragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
};
// ─── 同步滚动 ────────────────────────────────────────────────────────────────
const syncScroll = ref(true);
let syncingFrom = null;
let syncRaf = 0;
const doSyncFromLeft = () => {
    syncRaf = 0;
    if (!syncScroll.value || syncingFrom !== 'left') {
        syncingFrom = null;
        return;
    }
    const left = leftScroller.value;
    const right = rightScrollEl();
    if (!left || !right) {
        syncingFrom = null;
        return;
    }
    const leftMax = left.scrollHeight - left.clientHeight;
    const rightMax = right.scrollHeight - right.clientHeight;
    if (leftMax <= 0 || rightMax <= 0) {
        syncingFrom = null;
        return;
    }
    right.scrollTop = (left.scrollTop / leftMax) * rightMax;
    syncingFrom = null;
};
const doSyncFromNote = () => {
    syncRaf = 0;
    if (!syncScroll.value || syncingFrom !== 'note') {
        syncingFrom = null;
        return;
    }
    const left = leftScroller.value;
    const right = rightScrollEl();
    if (!left || !right) {
        syncingFrom = null;
        return;
    }
    const leftMax = left.scrollHeight - left.clientHeight;
    const rightMax = right.scrollHeight - right.clientHeight;
    if (leftMax <= 0 || rightMax <= 0) {
        syncingFrom = null;
        return;
    }
    left.scrollTop = (right.scrollTop / rightMax) * leftMax;
    syncingFrom = null;
};
const onLeftScroll = () => {
    const el = leftScroller.value;
    if (el) {
        leftScrolled.value = el.scrollTop > BACK_TOP_THRESHOLD;
        const max = el.scrollHeight - el.clientHeight;
        saveProgress(max > 0 ? el.scrollTop / max : 0);
    }
    if (syncingFrom === 'note')
        return;
    if (syncRaf)
        cancelAnimationFrame(syncRaf);
    syncingFrom = 'left';
    syncRaf = requestAnimationFrame(doSyncFromLeft);
};
const onRightScroll = () => {
    const el = rightScrollEl();
    if (el)
        rightScrolled.value = el.scrollTop > BACK_TOP_THRESHOLD;
    if (syncingFrom === 'left')
        return;
    if (syncRaf)
        cancelAnimationFrame(syncRaf);
    syncingFrom = 'note';
    syncRaf = requestAnimationFrame(doSyncFromNote);
};
// ─── 阅读进度 ────────────────────────────────────────────────────────────────
const readAllProgress = () => {
    try {
        return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}');
    }
    catch {
        return {};
    }
};
const saveProgress = (percent) => {
    try {
        const all = readAllProgress();
        all[props.queueId] = Number(percent.toFixed(4));
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
    }
    catch { /* ignore */ }
};
const restoreProgress = () => {
    const el = leftScroller.value;
    if (!el)
        return;
    const pct = readAllProgress()[props.queueId] ?? 0;
    const max = el.scrollHeight - el.clientHeight;
    el.scrollTop = max > 0 ? max * pct : 0;
};
const readAllNotes = () => {
    try {
        return JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}');
    }
    catch {
        return {};
    }
};
const noteContent = ref('');
const noteDirty = ref(false);
const saveNote = () => {
    if (!noteDirty.value)
        return;
    try {
        const all = readAllNotes();
        all[props.queueId] = { content: noteContent.value, savedAt: Date.now() };
        localStorage.setItem(NOTES_KEY, JSON.stringify(all));
        noteDirty.value = false;
    }
    catch { /* ignore */ }
};
const loadNote = () => {
    const rec = readAllNotes()[props.queueId];
    noteContent.value = rec?.content ?? '';
    noteDirty.value = false;
};
const onNoteInput = () => { noteDirty.value = true; };
/**
 * 点击 textarea 空白处（当前文本行数不足以覆盖点击位置）时，
 * 自动向文本末尾补足空行，使光标落在被点击的那一行 —— 像真正的记事本。
 *
 * 组件只负责「取坐标 + 读实时样式」这一薄层，具体行数计算交给纯函数
 * computeBlankLineInsertion（已单测）。数据修改一律走 noteContent（v-model），
 * 不手改 ta.value，避免与 Vue 声明式绑定冲突。
 */
const onNoteClick = (e) => {
    const ta = noteEditor.value;
    if (!ta)
        return;
    // 从实时 computedStyle 读取行高 / 顶部内边距，避免与 CSS 硬编码失配（含响应式）
    const cs = getComputedStyle(ta);
    const lineHeightPx = parseFloat(cs.lineHeight) || fontSize.value * 2;
    const paddingTop = parseFloat(cs.paddingTop) || 0;
    // 点击点相对 textarea 内容顶部的 Y（含滚动、去除 padding-top）
    const rect = ta.getBoundingClientRect();
    const offsetY = e.clientY - rect.top - paddingTop + ta.scrollTop;
    const { linesToAppend, caretPos } = computeBlankLineInsertion({
        offsetY,
        lineHeightPx,
        value: ta.value,
    });
    // caretPos === -1 表示点在已有文本内，浏览器已正确定位，无需干预
    if (linesToAppend <= 0 || caretPos < 0)
        return;
    // 数据驱动：只改 noteContent，DOM 由 v-model patch，nextTick 后再定位光标
    noteContent.value = ta.value + '\n'.repeat(linesToAppend);
    noteDirty.value = true;
    nextTick(() => {
        ta.focus();
        ta.setSelectionRange(caretPos, caretPos);
    });
};
// ─── 5 分钟自动保存 ──────────────────────────────────────────────────────────
let autoSaveTimer = null;
const startAutoSave = () => {
    if (autoSaveTimer)
        return;
    autoSaveTimer = setInterval(saveNote, AUTO_SAVE_MS);
};
const stopAutoSave = () => {
    if (!autoSaveTimer)
        return;
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
};
// ─── 偏好 ────────────────────────────────────────────────────────────────────
const loadPrefs = () => {
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (!raw)
            return;
        const prefs = JSON.parse(raw);
        if (prefs.theme && themes.some((t) => t.key === prefs.theme))
            theme.value = prefs.theme;
        if (typeof prefs.fontSize === 'number')
            fontSize.value = Math.min(MAX_FONT, Math.max(MIN_FONT, prefs.fontSize));
    }
    catch { /* ignore */ }
};
const savePrefs = () => {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify({ theme: theme.value, fontSize: fontSize.value }));
    }
    catch { /* ignore */ }
};
const changeFont = (delta) => {
    fontSize.value = Math.min(MAX_FONT, Math.max(MIN_FONT, fontSize.value + delta));
};
// ─── 导出笔记 ────────────────────────────────────────────────────────────────
const exportNote = () => {
    const content = formatNote(noteContent.value);
    if (!content)
        return;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = noteFileName(props.title);
    a.click();
    URL.revokeObjectURL(url);
};
// ─── 关闭 ────────────────────────────────────────────────────────────────────
const close = () => {
    saveNote();
    emit('close');
};
const onKeydown = (e) => { if (e.key === 'Escape')
    close(); };
const onBeforeUnload = () => { saveNote(); };
// ─── 渲染 ────────────────────────────────────────────────────────────────────
const html = computed(() => renderMarkdown(props.source));
const noteHtml = computed(() => renderMarkdown(noteContent.value));
const hasContent = computed(() => Boolean(props.source?.trim()));
// ─── 生命周期 ────────────────────────────────────────────────────────────────
watch([theme, fontSize], savePrefs);
watch(() => props.queueId, async () => {
    saveNote();
    await nextTick();
    loadNote();
    restoreProgress();
});
onMounted(async () => {
    loadPrefs();
    loadNote();
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('mousemove', onMousemove);
    window.addEventListener('mouseup', onMouseup);
    await nextTick();
    restoreProgress();
    // 监听左侧内容高度变化，同步右侧 min-height
    if (leftScroller.value) {
        syncContentHeight();
        leftResizeObserver = new ResizeObserver(syncContentHeight);
        leftResizeObserver.observe(leftScroller.value);
    }
});
onBeforeUnmount(() => {
    saveNote();
    stopAutoSave();
    leftResizeObserver?.disconnect();
    window.removeEventListener('keydown', onKeydown);
    window.removeEventListener('beforeunload', onBeforeUnload);
    window.removeEventListener('mousemove', onMousemove);
    window.removeEventListener('mouseup', onMouseup);
    if (syncRaf)
        cancelAnimationFrame(syncRaf);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "reader-overlay" },
    ...{ class: (`reader-theme-${__VLS_ctx.theme}`) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
    ...{ class: "reader-bar" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "reader-bar-left" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.close) },
    ...{ class: "reader-close" },
    type: "button",
    'aria-label': "关闭阅读",
});
/** @type {[typeof BaseIcon, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
    name: "close",
    size: (18),
}));
const __VLS_1 = __VLS_0({
    name: "close",
    size: (18),
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "reader-heading" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.title);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "reader-tools" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "reader-theme-switch" },
    role: "group",
    'aria-label': "护眼主题",
});
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.themes))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.theme = item.key;
            } },
        key: (item.key),
        type: "button",
        ...{ class: ({ active: __VLS_ctx.theme === item.key }) },
        'aria-pressed': (__VLS_ctx.theme === item.key),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
        ...{ class: (`swatch-${item.key}`) },
    });
    (item.label);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "reader-font" },
    role: "group",
    'aria-label': "字号调节",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.changeFont(-1);
        } },
    type: "button",
    'aria-label': "缩小字号",
    disabled: (__VLS_ctx.fontSize <= __VLS_ctx.MIN_FONT),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.fontSize);
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.changeFont(1);
        } },
    type: "button",
    'aria-label': "放大字号",
    disabled: (__VLS_ctx.fontSize >= __VLS_ctx.MAX_FONT),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.syncScroll = !__VLS_ctx.syncScroll;
        } },
    ...{ class: "reader-sync-btn" },
    type: "button",
    ...{ class: ({ active: __VLS_ctx.syncScroll }) },
    title: (__VLS_ctx.syncScroll ? '同步滚动（点击切换为独立滚动）' : '独立滚动（点击切换为同步滚动）'),
});
/** @type {[typeof BaseIcon, ]} */ ;
// @ts-ignore
const __VLS_3 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
    name: (__VLS_ctx.syncScroll ? 'link' : 'unlink'),
    size: (15),
}));
const __VLS_4 = __VLS_3({
    name: (__VLS_ctx.syncScroll ? 'link' : 'unlink'),
    size: (15),
}, ...__VLS_functionalComponentArgsRest(__VLS_3));
(__VLS_ctx.syncScroll ? '同步' : '独立');
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.exportNote) },
    ...{ class: "reader-export-btn" },
    type: "button",
    disabled: (!__VLS_ctx.noteContent.trim()),
    title: "导出笔记为 .md 文件",
});
/** @type {[typeof BaseIcon, ]} */ ;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
    name: "download",
    size: (15),
}));
const __VLS_7 = __VLS_6({
    name: "download",
    size: (15),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ref: "container",
    ...{ class: "reader-body" },
});
/** @type {typeof __VLS_ctx.container} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "reader-pane-wrap" },
    ...{ style: ({ width: `${__VLS_ctx.leftPercent}%` }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ onScroll: (__VLS_ctx.onLeftScroll) },
    ref: "leftScroller",
    ...{ class: "reader-pane reader-pane-left" },
});
/** @type {typeof __VLS_ctx.leftScroller} */ ;
if (__VLS_ctx.hasContent) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
        ...{ class: "reader-prose" },
        ...{ style: ({ fontSize: `${__VLS_ctx.fontSize}px` }) },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vHtml)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.html) }, null, null);
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "reader-empty" },
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "file",
        size: (30),
    }));
    const __VLS_10 = __VLS_9({
        name: "file",
        size: (30),
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.scrollLeftTop) },
    ...{ class: "back-top" },
    type: "button",
    title: "回到顶部",
});
__VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.leftScrolled) }, null, null);
/** @type {[typeof BaseIcon, ]} */ ;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
    name: "arrow-up",
    size: (16),
}));
const __VLS_13 = __VLS_12({
    name: "arrow-up",
    size: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_12));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ onMousedown: (__VLS_ctx.onDividerMousedown) },
    ...{ class: "reader-divider" },
    title: "拖拽调整宽度",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "reader-divider-handle" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ onMouseenter: (__VLS_ctx.startAutoSave) },
    ...{ onMouseleave: (__VLS_ctx.stopAutoSave) },
    ...{ class: "reader-pane-wrap" },
    ...{ style: ({ width: `${100 - __VLS_ctx.leftPercent}%` }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "note-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "note-mode-switch" },
    role: "group",
    'aria-label': "笔记模式",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.noteMode = 'preview';
        } },
    type: "button",
    ...{ class: ({ active: __VLS_ctx.noteMode === 'preview' }) },
});
/** @type {[typeof BaseIcon, ]} */ ;
// @ts-ignore
const __VLS_15 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
    name: "file",
    size: (13),
}));
const __VLS_16 = __VLS_15({
    name: "file",
    size: (13),
}, ...__VLS_functionalComponentArgsRest(__VLS_15));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.noteMode = 'edit';
        } },
    type: "button",
    ...{ class: ({ active: __VLS_ctx.noteMode === 'edit' }) },
});
/** @type {[typeof BaseIcon, ]} */ ;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
    name: "edit",
    size: (13),
}));
const __VLS_19 = __VLS_18({
    name: "edit",
    size: (13),
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
if (__VLS_ctx.noteDirty) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "note-unsaved" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.saveNote) },
    ...{ class: "note-save-btn" },
    type: "button",
    title: "立即保存",
});
/** @type {[typeof BaseIcon, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
    name: "save",
    size: (14),
}));
const __VLS_22 = __VLS_21({
    name: "save",
    size: (14),
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ onScroll: (__VLS_ctx.onRightScroll) },
    ref: "noteScroller",
    ...{ class: "note-body" },
});
/** @type {typeof __VLS_ctx.noteScroller} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)({
    ...{ onInput: (__VLS_ctx.onNoteInput) },
    ...{ onClick: (__VLS_ctx.onNoteClick) },
    ref: "noteEditor",
    value: (__VLS_ctx.noteContent),
    ...{ class: "note-textarea" },
    ...{ style: ({
            fontSize: `${__VLS_ctx.fontSize}px`,
            lineHeight: '2',
            minHeight: __VLS_ctx.contentMinHeight ? `${__VLS_ctx.contentMinHeight}px` : '100%',
        }) },
    placeholder: "随手记录你的想法、理解、疑问……",
    spellcheck: "false",
});
__VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.noteMode === 'edit') }, null, null);
/** @type {typeof __VLS_ctx.noteEditor} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "note-preview-pane" },
    ...{ style: ({ minHeight: __VLS_ctx.contentMinHeight ? `${__VLS_ctx.contentMinHeight}px` : '100%' }) },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.noteMode === 'preview') }, null, null);
if (__VLS_ctx.noteContent.trim()) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
        ...{ class: "reader-prose note-prose" },
        ...{ style: ({ fontSize: `${__VLS_ctx.fontSize}px` }) },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vHtml)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.noteHtml) }, null, null);
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "note-empty" },
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_24 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "edit",
        size: (28),
    }));
    const __VLS_25 = __VLS_24({
        name: "edit",
        size: (28),
    }, ...__VLS_functionalComponentArgsRest(__VLS_24));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.noteContent.trim()))
                    return;
                __VLS_ctx.noteMode = 'edit';
            } },
        ...{ class: "note-empty-btn" },
        type: "button",
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_27 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "edit",
        size: (14),
    }));
    const __VLS_28 = __VLS_27({
        name: "edit",
        size: (14),
    }, ...__VLS_functionalComponentArgsRest(__VLS_27));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.scrollRightTop) },
    ...{ class: "back-top" },
    type: "button",
    title: "回到顶部",
});
__VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.rightScrolled) }, null, null);
/** @type {[typeof BaseIcon, ]} */ ;
// @ts-ignore
const __VLS_30 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
    name: "arrow-up",
    size: (16),
}));
const __VLS_31 = __VLS_30({
    name: "arrow-up",
    size: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_30));
/** @type {__VLS_StyleScopedClasses['reader-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-bar-left']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-close']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-heading']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-tools']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-theme-switch']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-font']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-sync-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-export-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-body']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-pane-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-pane']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-pane-left']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-prose']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['back-top']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-divider']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-divider-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-pane-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['note-header']} */ ;
/** @type {__VLS_StyleScopedClasses['note-mode-switch']} */ ;
/** @type {__VLS_StyleScopedClasses['note-unsaved']} */ ;
/** @type {__VLS_StyleScopedClasses['note-save-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['note-body']} */ ;
/** @type {__VLS_StyleScopedClasses['note-textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['note-preview-pane']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-prose']} */ ;
/** @type {__VLS_StyleScopedClasses['note-prose']} */ ;
/** @type {__VLS_StyleScopedClasses['note-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['note-empty-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['back-top']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            BaseIcon: BaseIcon,
            themes: themes,
            MIN_FONT: MIN_FONT,
            MAX_FONT: MAX_FONT,
            theme: theme,
            fontSize: fontSize,
            noteMode: noteMode,
            leftScroller: leftScroller,
            noteEditor: noteEditor,
            noteScroller: noteScroller,
            container: container,
            leftScrolled: leftScrolled,
            rightScrolled: rightScrolled,
            contentMinHeight: contentMinHeight,
            scrollLeftTop: scrollLeftTop,
            scrollRightTop: scrollRightTop,
            leftPercent: leftPercent,
            onDividerMousedown: onDividerMousedown,
            syncScroll: syncScroll,
            onLeftScroll: onLeftScroll,
            onRightScroll: onRightScroll,
            noteContent: noteContent,
            noteDirty: noteDirty,
            saveNote: saveNote,
            onNoteInput: onNoteInput,
            onNoteClick: onNoteClick,
            startAutoSave: startAutoSave,
            stopAutoSave: stopAutoSave,
            changeFont: changeFont,
            exportNote: exportNote,
            close: close,
            html: html,
            noteHtml: noteHtml,
            hasContent: hasContent,
        };
    },
    __typeEmits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
