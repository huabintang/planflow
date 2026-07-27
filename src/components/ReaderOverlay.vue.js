import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import BaseIcon from './BaseIcon.vue';
import { renderMarkdown } from '../utils/renderMarkdown';
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
const MIN_FONT = 15;
const MAX_FONT = 26;
const theme = ref('paper');
const fontSize = ref(18);
const scroller = ref(null);
const html = computed(() => renderMarkdown(props.source));
const hasContent = computed(() => Boolean(props.source && props.source.trim()));
const readAllProgress = () => {
    try {
        const raw = localStorage.getItem(PROGRESS_KEY);
        return raw ? JSON.parse(raw) : {};
    }
    catch {
        return {};
    }
};
const loadPrefs = () => {
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (!raw)
            return;
        const prefs = JSON.parse(raw);
        if (prefs.theme && themes.some((item) => item.key === prefs.theme))
            theme.value = prefs.theme;
        if (typeof prefs.fontSize === 'number')
            fontSize.value = Math.min(MAX_FONT, Math.max(MIN_FONT, prefs.fontSize));
    }
    catch {
        /* 偏好读取失败时保持默认值 */
    }
};
const savePrefs = () => {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify({ theme: theme.value, fontSize: fontSize.value }));
    }
    catch {
        /* 忽略存储异常 */
    }
};
const saveProgress = (percent) => {
    try {
        const all = readAllProgress();
        all[props.queueId] = Number(percent.toFixed(4));
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
    }
    catch {
        /* 忽略存储异常 */
    }
};
const restoreProgress = () => {
    const el = scroller.value;
    if (!el)
        return;
    const percent = readAllProgress()[props.queueId] ?? 0;
    const max = el.scrollHeight - el.clientHeight;
    el.scrollTop = max > 0 ? max * percent : 0;
};
let scrollRaf = 0;
const onScroll = () => {
    if (scrollRaf)
        return;
    scrollRaf = window.requestAnimationFrame(() => {
        scrollRaf = 0;
        const el = scroller.value;
        if (!el)
            return;
        const max = el.scrollHeight - el.clientHeight;
        saveProgress(max > 0 ? el.scrollTop / max : 0);
    });
};
const changeFont = (delta) => {
    fontSize.value = Math.min(MAX_FONT, Math.max(MIN_FONT, fontSize.value + delta));
};
const close = () => emit('close');
const onKeydown = (event) => {
    if (event.key === 'Escape')
        close();
};
watch([theme, fontSize], savePrefs);
// 内容变化（切换到别的队列）时，等 DOM 更新后恢复该队列的阅读位置。
watch(() => props.queueId, async () => {
    await nextTick();
    restoreProgress();
});
onMounted(async () => {
    loadPrefs();
    window.addEventListener('keydown', onKeydown);
    await nextTick();
    restoreProgress();
});
onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown);
    if (scrollRaf)
        window.cancelAnimationFrame(scrollRaf);
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ onScroll: (__VLS_ctx.onScroll) },
    ref: "scroller",
    ...{ class: "reader-scroll" },
});
/** @type {typeof __VLS_ctx.scroller} */ ;
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
    const __VLS_3 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "file",
        size: (30),
    }));
    const __VLS_4 = __VLS_3({
        name: "file",
        size: (30),
    }, ...__VLS_functionalComponentArgsRest(__VLS_3));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
}
/** @type {__VLS_StyleScopedClasses['reader-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-bar-left']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-close']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-heading']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-tools']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-theme-switch']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-font']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-scroll']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-prose']} */ ;
/** @type {__VLS_StyleScopedClasses['reader-empty']} */ ;
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
            scroller: scroller,
            html: html,
            hasContent: hasContent,
            onScroll: onScroll,
            changeFont: changeFont,
            close: close,
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
