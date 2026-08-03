import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import BaseIcon from './components/BaseIcon.vue';
import ReaderOverlay from './components/ReaderOverlay.vue';
import { parseMarkdown } from './utils/markdownParser';
import { describeRepeat, generateDailyTasks } from './utils/dailyPlan';
const STORAGE_KEY = 'planflow.file-queues.v2';
const MAX_TASK_DETAILS = 24;
const DAILY_QUEUE_ID = 'queue-daily-plan';
const queueTypes = ['学习', '工作', '生活', '运动', '其他'];
// 周一在前、周日在后的选择顺序，value 与 Date.getDay() 对齐（0=周日）。
const weekdayOptions = [
    { value: 1, label: '周一' },
    { value: 2, label: '周二' },
    { value: 3, label: '周三' },
    { value: 4, label: '周四' },
    { value: 5, label: '周五' },
    { value: 6, label: '周六' },
    { value: 0, label: '周日' },
];
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
];
const queues = ref([]);
const selectedQueueId = ref('');
const queueSearch = ref('');
const taskSearch = ref('');
const quickTaskTitle = ref('');
const taskFilter = ref('all');
const fileInput = ref(null);
const isImporting = ref(false);
const isDragging = ref(false);
const dragDepth = ref(0);
const sidebarOpen = ref(false);
const changedTaskId = ref('');
const expandedTaskId = ref('');
const readerOpen = ref(false);
const modalMode = ref(null);
const editingTaskId = ref('');
const editingQueueId = ref('');
const taskDraft = ref({
    title: '',
    time: '',
    note: '',
    details: '',
    repeat: 'none',
    weekdays: [],
});
const queueDraft = ref({ name: '', type: '其他' });
const confirmTarget = ref(null);
const toast = ref({ visible: false, title: '', detail: '', tone: 'success' });
let toastTimer;
let changedTimer;
const selectedQueue = computed(() => queues.value.find((queue) => queue.id === selectedQueueId.value) ?? null);
const visibleQueues = computed(() => {
    const query = queueSearch.value.trim().toLowerCase();
    if (!query)
        return queues.value;
    return queues.value.filter((queue) => `${queue.name} ${queue.sourceName} ${queue.type}`.toLowerCase().includes(query));
});
const queueTaskCount = computed(() => queues.value.reduce((sum, queue) => sum + queue.tasks.length, 0));
const queueCompletedCount = computed(() => queues.value.reduce((sum, queue) => sum + queue.tasks.filter((task) => task.completed).length, 0));
const selectedCompleted = computed(() => selectedQueue.value?.tasks.filter((task) => task.completed).length ?? 0);
const selectedTotal = computed(() => selectedQueue.value?.tasks.length ?? 0);
const selectedProgress = computed(() => selectedTotal.value ? Math.round(selectedCompleted.value / selectedTotal.value * 100) : 0);
const focusedHourTask = computed(() => {
    const hourTasks = selectedQueue.value?.tasks
        .filter(isHourTask)
        .slice()
        .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)) ?? [];
    if (!hourTasks.length)
        return null;
    return hourTasks.find((task) => task.id === expandedTaskId.value)
        ?? hourTasks.find((task) => !task.completed)
        ?? hourTasks[hourTasks.length - 1];
});
const filteredTasks = computed(() => {
    if (!selectedQueue.value)
        return [];
    const query = taskSearch.value.trim().toLowerCase();
    return [...selectedQueue.value.tasks]
        .filter((task) => {
        if (taskFilter.value === 'todo' && task.completed)
            return false;
        if (taskFilter.value === 'done' && !task.completed)
            return false;
        return !query || `${task.title} ${task.note} ${task.time}`.toLowerCase().includes(query);
    })
        .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time) || a.createdAt.localeCompare(b.createdAt));
});
const taskFilterCounts = computed(() => ({
    all: selectedTotal.value,
    todo: selectedTotal.value - selectedCompleted.value,
    done: selectedCompleted.value,
}));
const showToast = (title, detail, tone = 'success') => {
    if (toastTimer)
        window.clearTimeout(toastTimer);
    toast.value = { visible: true, title, detail, tone };
    toastTimer = window.setTimeout(() => { toast.value.visible = false; }, 3000);
};
const persist = () => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ queues: queues.value, selectedQueueId: selectedQueueId.value }));
    }
    catch {
        showToast('保存失败', '浏览器本地存储当前不可用', 'warning');
    }
};
onMounted(() => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            queues.value = Array.isArray(data.queues) ? data.queues.map((queue) => ({
                ...queue,
                templates: Array.isArray(queue.templates) ? queue.templates : undefined,
                tasks: Array.isArray(queue.tasks) ? queue.tasks.map((task) => ({
                    ...task,
                    note: task.note ?? '',
                    details: Array.isArray(task.details) ? task.details : [],
                })) : [],
            })) : [];
            selectedQueueId.value = data.selectedQueueId ?? queues.value[0]?.id ?? '';
            if (!queues.value.some((queue) => queue.id === selectedQueueId.value))
                selectedQueueId.value = queues.value[0]?.id ?? '';
        }
    }
    catch {
        queues.value = [];
        selectedQueueId.value = '';
    }
    // 打开应用时，为今天补齐每日计划任务（只生成今天、已生成的不重复）。
    runDailyGeneration();
    window.addEventListener('keydown', handleKeydown);
});
onUnmounted(() => window.removeEventListener('keydown', handleKeydown));
watch([queues, selectedQueueId], persist, { deep: true });
const handleKeydown = (event) => {
    if (event.key === 'Escape') {
        modalMode.value = null;
        confirmTarget.value = null;
        sidebarOpen.value = false;
    }
};
function timeToMinutes(time) {
    const hourCode = time.match(/^H(\d{1,3})$/i);
    if (hourCode)
        return Number(hourCode[1]) * 60;
    const match = time.match(/^(\d{2}):(\d{2})$/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : 1440;
}
function normalizeTaskTime(time) {
    const value = time.trim();
    const hourCode = value.match(/^H\s*(\d{1,3})$/i);
    if (hourCode)
        return `H${String(Number(hourCode[1])).padStart(3, '0')}`;
    const clock = value.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    return clock ? `${clock[1].padStart(2, '0')}:${clock[2]}` : value.slice(0, 20);
}
function isHourTask(task) {
    return /^H\d{1,3}$/i.test(task.time);
}
function motivationForTask(task) {
    const match = task.time.match(/^H(\d{1,3})$/i);
    const hour = match ? Number(match[1]) : 1;
    return hourMotivations[(Math.max(1, hour) - 1) % hourMotivations.length];
}
const queueProgress = (queue) => {
    if (!queue.tasks.length)
        return 0;
    return Math.round(queue.tasks.filter((task) => task.completed).length / queue.tasks.length * 100);
};
const selectQueue = (id) => {
    selectedQueueId.value = id;
    taskSearch.value = '';
    taskFilter.value = 'all';
    expandedTaskId.value = '';
    sidebarOpen.value = false;
};
const touchQueue = (queue) => {
    queue.updatedAt = new Date().toISOString();
};
const flashTask = (id) => {
    if (changedTimer)
        window.clearTimeout(changedTimer);
    changedTaskId.value = id;
    changedTimer = window.setTimeout(() => { changedTaskId.value = ''; }, 650);
};
const toggleTask = (task) => {
    if (!selectedQueue.value)
        return;
    task.completed = !task.completed;
    task.updatedAt = new Date().toISOString();
    touchQueue(selectedQueue.value);
    flashTask(task.id);
    showToast(task.completed ? '已标记完成' : '已恢复为待办', task.title);
};
const toggleExpanded = (taskId) => {
    expandedTaskId.value = expandedTaskId.value === taskId ? '' : taskId;
};
const quickAddTask = () => {
    const queue = selectedQueue.value;
    const title = quickTaskTitle.value.trim();
    if (!queue || !title)
        return;
    const now = new Date().toISOString();
    const task = {
        id: createId('task'),
        title,
        completed: false,
        time: '',
        note: '',
        details: [],
        createdAt: now,
        updatedAt: now,
    };
    queue.tasks.push(task);
    touchQueue(queue);
    quickTaskTitle.value = '';
    flashTask(task.id);
    showToast('任务已添加', title);
};
const openNewTask = () => {
    if (!selectedQueue.value)
        return;
    editingTaskId.value = '';
    taskDraft.value = { title: '', time: '', note: '', details: '', repeat: 'none', weekdays: [] };
    modalMode.value = 'task';
};
const openEditTask = (task) => {
    editingTaskId.value = task.id;
    let repeat = 'none';
    let weekdays = [];
    const template = task.templateId ? findTemplate(task.templateId) : null;
    if (template) {
        repeat = template.repeat.kind;
        weekdays = [...template.repeat.days];
    }
    taskDraft.value = { title: task.title, time: task.time, note: task.note, details: task.details.join('\n'), repeat, weekdays };
    modalMode.value = 'task';
};
// —— 每日计划：模板存放于固定的“每日计划”队列，行为与普通导入队列隔离 ——
const findDailyQueue = () => queues.value.find((queue) => queue.id === DAILY_QUEUE_ID) ?? null;
const findTemplate = (templateId) => findDailyQueue()?.templates?.find((template) => template.id === templateId) ?? null;
const ensureDailyQueue = () => {
    let queue = findDailyQueue();
    if (!queue) {
        const now = new Date().toISOString();
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
        };
        queues.value.unshift(queue);
    }
    if (!queue.templates)
        queue.templates = [];
    return queue;
};
const runDailyGeneration = () => {
    const queue = findDailyQueue();
    if (!queue?.templates?.length)
        return;
    const generated = generateDailyTasks(queue.templates, queue.tasks, new Date(), createId);
    if (generated.length) {
        queue.tasks.push(...generated);
        queue.updatedAt = new Date().toISOString();
    }
};
const toggleWeekday = (day) => {
    const index = taskDraft.value.weekdays.indexOf(day);
    if (index >= 0)
        taskDraft.value.weekdays.splice(index, 1);
    else
        taskDraft.value.weekdays.push(day);
};
const repeatLabelForTask = (task) => {
    const template = task.templateId ? findTemplate(task.templateId) : null;
    return template ? describeRepeat(template.repeat) : '';
};
const stopRepeat = (task) => {
    const queue = findDailyQueue();
    if (!task.templateId || !queue?.templates)
        return;
    queue.templates = queue.templates.filter((template) => template.id !== task.templateId);
    touchQueue(queue);
    showToast('已停止重复', `「${task.title}」以后不再自动生成`);
};
const saveTask = () => {
    const title = taskDraft.value.title.trim();
    if (!title)
        return;
    const now = new Date().toISOString();
    const note = taskDraft.value.note.trim();
    const details = taskDraft.value.details.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, MAX_TASK_DETAILS);
    const taskTime = normalizeTaskTime(taskDraft.value.time);
    const kind = taskDraft.value.repeat;
    const repeat = kind === 'daily' ? { kind: 'daily', days: [] }
        : kind === 'weekly' ? { kind: 'weekly', days: [...taskDraft.value.weekdays].sort((a, b) => a - b) }
            : null;
    // 每周指定至少要选一天，否则不保存。
    if (repeat?.kind === 'weekly' && !repeat.days.length)
        return;
    if (editingTaskId.value) {
        const queue = selectedQueue.value;
        const task = queue?.tasks.find((item) => item.id === editingTaskId.value);
        if (!queue || !task)
            return;
        task.title = title;
        task.time = taskTime;
        task.note = note;
        task.details = details;
        task.updatedAt = now;
        // 若这是由每日模板生成的任务，同步更新模板，让以后生成也跟着改。
        const template = task.templateId ? findTemplate(task.templateId) : null;
        if (template) {
            template.title = title;
            template.note = note;
            template.details = [...details];
            if (repeat)
                template.repeat = repeat;
            template.updatedAt = now;
        }
        touchQueue(queue);
        flashTask(task.id);
        showToast('任务已保存', title);
        modalMode.value = null;
        return;
    }
    // 新建且设置了重复：存为每日计划模板，并立即为今天生成（若命中）。
    if (repeat) {
        const queue = ensureDailyQueue();
        const template = {
            id: createId('tpl'),
            title,
            note,
            details,
            repeat,
            createdAt: now,
            updatedAt: now,
        };
        queue.templates.push(template);
        const generated = generateDailyTasks([template], queue.tasks, new Date(), createId);
        queue.tasks.push(...generated);
        touchQueue(queue);
        selectedQueueId.value = queue.id;
        if (generated[0])
            flashTask(generated[0].id);
        showToast('每日计划已创建', `${title} · ${describeRepeat(repeat)}`);
        modalMode.value = null;
        return;
    }
    // 新建普通一次性任务。
    const queue = selectedQueue.value;
    if (!queue)
        return;
    const task = {
        id: createId('task'),
        title,
        completed: false,
        time: taskTime,
        note,
        details,
        createdAt: now,
        updatedAt: now,
    };
    queue.tasks.push(task);
    touchQueue(queue);
    flashTask(task.id);
    showToast('任务已添加', `已加入「${queue.name}」`);
    modalMode.value = null;
};
const openNewQueue = () => {
    editingQueueId.value = '';
    queueDraft.value = { name: '', type: '其他' };
    modalMode.value = 'queue';
};
const openEditQueue = () => {
    if (!selectedQueue.value)
        return;
    editingQueueId.value = selectedQueue.value.id;
    queueDraft.value = { name: selectedQueue.value.name, type: selectedQueue.value.type };
    modalMode.value = 'queue';
};
const saveQueue = () => {
    const name = queueDraft.value.name.trim();
    if (!name)
        return;
    if (editingQueueId.value) {
        const queue = queues.value.find((item) => item.id === editingQueueId.value);
        if (!queue)
            return;
        queue.name = name;
        queue.type = queueDraft.value.type;
        touchQueue(queue);
        showToast('队列已更新', name);
    }
    else {
        createQueue(name);
    }
    editingQueueId.value = '';
    modalMode.value = null;
};
const createQueue = (name) => {
    const now = new Date().toISOString();
    const queue = {
        id: createId('queue'),
        name,
        sourceName: `${name}.md`,
        type: queueDraft.value.type,
        tasks: [],
        createdAt: now,
        updatedAt: now,
        importMessage: '手动创建的空队列',
    };
    queues.value.unshift(queue);
    selectedQueueId.value = queue.id;
    showToast('队列已创建', name);
};
const requestDeleteTask = (task) => {
    confirmTarget.value = { kind: 'task', id: task.id, name: task.title };
};
const requestDeleteQueue = (queue) => {
    confirmTarget.value = { kind: 'queue', id: queue.id, name: queue.name };
};
const confirmDelete = () => {
    const target = confirmTarget.value;
    if (!target)
        return;
    if (target.kind === 'task' && selectedQueue.value) {
        selectedQueue.value.tasks = selectedQueue.value.tasks.filter((task) => task.id !== target.id);
        touchQueue(selectedQueue.value);
        showToast('任务已删除', target.name);
    }
    else {
        const index = queues.value.findIndex((queue) => queue.id === target.id);
        queues.value = queues.value.filter((queue) => queue.id !== target.id);
        if (selectedQueueId.value === target.id) {
            selectedQueueId.value = queues.value[Math.min(index, queues.value.length - 1)]?.id ?? '';
        }
        showToast('队列已删除', target.name);
    }
    confirmTarget.value = null;
};
const createId = (prefix) => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
};
const openFilePicker = () => {
    if (!isImporting.value)
        fileInput.value?.click();
};
const importFiles = async (input) => {
    const validFiles = Array.from(input).filter((file) => /\.(md|markdown|txt)$/i.test(file.name));
    if (!validFiles.length) {
        showToast('没有可导入的文件', '请选择 .md、.markdown 或 .txt 文件', 'warning');
        return;
    }
    isImporting.value = true;
    try {
        const results = await Promise.all(validFiles.map(async (file) => parseMarkdown(await file.text(), file.name)));
        let taskCount = 0;
        let emptyCount = 0;
        let truncatedCount = 0;
        let firstQueueId = '';
        results.forEach(({ queue, recognized, truncated }) => {
            const existingIndex = queues.value.findIndex((item) => item.sourceName === queue.sourceName);
            if (existingIndex >= 0) {
                const existing = queues.value[existingIndex];
                const oldTasks = new Map(existing.tasks.map((task) => [`${task.time}|${task.title}`.toLowerCase(), task]));
                queue.id = existing.id;
                queue.name = existing.name;
                queue.type = existing.type;
                queue.createdAt = existing.createdAt;
                queue.tasks = queue.tasks.map((task) => {
                    const oldTask = oldTasks.get(`${task.time}|${task.title}`.toLowerCase());
                    return oldTask ? { ...task, id: oldTask.id, completed: oldTask.completed, createdAt: oldTask.createdAt } : task;
                });
                queues.value.splice(existingIndex, 1, queue);
            }
            else {
                queues.value.push(queue);
            }
            firstQueueId ||= queue.id;
            taskCount += recognized;
            if (!recognized)
                emptyCount += 1;
            if (truncated)
                truncatedCount += 1;
        });
        selectedQueueId.value = firstQueueId;
        taskFilter.value = 'all';
        taskSearch.value = '';
        const details = [`${results.length} 个文件 = ${results.length} 个独立队列`, `${taskCount} 个明确任务`];
        if (emptyCount)
            details.push(`${emptyCount} 个空队列`);
        if (truncatedCount)
            details.push(`${truncatedCount} 个文件触发数量保护`);
        showToast('导入完成', details.join(' · '), truncatedCount ? 'warning' : 'success');
    }
    catch {
        showToast('导入失败', '读取文件时发生错误，请重试', 'warning');
    }
    finally {
        isImporting.value = false;
    }
};
const onFileInput = async (event) => {
    const input = event.target;
    if (input.files?.length)
        await importFiles(input.files);
    input.value = '';
};
const onDragEnter = (event) => {
    if (!event.dataTransfer?.types.includes('Files'))
        return;
    dragDepth.value += 1;
    isDragging.value = true;
};
const onDragLeave = () => {
    dragDepth.value = Math.max(0, dragDepth.value - 1);
    if (!dragDepth.value)
        isDragging.value = false;
};
const onDrop = async (event) => {
    dragDepth.value = 0;
    isDragging.value = false;
    if (event.dataTransfer?.files.length)
        await importFiles(event.dataTransfer.files);
};
const exportQueue = () => {
    const queue = selectedQueue.value;
    if (!queue)
        return;
    const lines = [`# ${queue.name}`, ''];
    queue.tasks
        .slice()
        .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
        .forEach((task) => {
        lines.push(`- [${task.completed ? 'x' : ' '}] ${task.time ? `${task.time} ` : ''}${task.title}`);
        if (task.note)
            lines.push(`  - ${task.note}`);
        task.details.forEach((detail) => lines.push(`  - ${detail}`));
    });
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${queue.name}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('队列已导出', `${queue.name}.md`);
};
const formatUpdatedAt = (value) => {
    const date = new Date(value);
    return `更新于 ${date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ onDragenter: (__VLS_ctx.onDragEnter) },
    ...{ onDragover: () => { } },
    ...{ onDragleave: (__VLS_ctx.onDragLeave) },
    ...{ onDrop: (__VLS_ctx.onDrop) },
    ...{ class: "queue-app" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.aside, __VLS_intrinsicElements.aside)({
    ...{ class: "queue-sidebar" },
    ...{ class: ({ open: __VLS_ctx.sidebarOpen }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "sidebar-brand" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "simple-logo" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.sidebarOpen = false;
        } },
    ...{ class: "sidebar-close" },
    type: "button",
    'aria-label': "关闭队列列表",
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
    ...{ class: "sidebar-actions" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.openFilePicker) },
    ...{ class: "import-button" },
    type: "button",
    disabled: (__VLS_ctx.isImporting),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: ({ spinning: __VLS_ctx.isImporting }) },
});
/** @type {[typeof BaseIcon, ]} */ ;
// @ts-ignore
const __VLS_3 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
    name: (__VLS_ctx.isImporting ? 'refresh' : 'upload'),
    size: (17),
}));
const __VLS_4 = __VLS_3({
    name: (__VLS_ctx.isImporting ? 'refresh' : 'upload'),
    size: (17),
}, ...__VLS_functionalComponentArgsRest(__VLS_3));
(__VLS_ctx.isImporting ? '正在导入…' : '导入计划文件');
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.openNewQueue) },
    ...{ class: "new-queue-button" },
    type: "button",
    title: "新建空队列",
});
/** @type {[typeof BaseIcon, ]} */ ;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
    name: "plus",
    size: (18),
}));
const __VLS_7 = __VLS_6({
    name: "plus",
    size: (18),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "sidebar-search" },
});
/** @type {[typeof BaseIcon, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
    name: "search",
    size: (16),
}));
const __VLS_10 = __VLS_9({
    name: "search",
    size: (16),
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "search",
    placeholder: "搜索文件队列",
});
(__VLS_ctx.queueSearch);
if (__VLS_ctx.queueSearch) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.queueSearch))
                    return;
                __VLS_ctx.queueSearch = '';
            } },
        type: "button",
        'aria-label': "清空搜索",
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_12 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "close",
        size: (13),
    }));
    const __VLS_13 = __VLS_12({
        name: "close",
        size: (13),
    }, ...__VLS_functionalComponentArgsRest(__VLS_12));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "queue-summary" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.b, __VLS_intrinsicElements.b)({});
(__VLS_ctx.queues.length);
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.queueCompletedCount);
(__VLS_ctx.queueTaskCount);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "queue-list" },
});
for (const [queue] of __VLS_getVForSourceType((__VLS_ctx.visibleQueues))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (queue.id),
        ...{ class: "queue-list-item" },
        ...{ class: ({ active: __VLS_ctx.selectedQueueId === queue.id }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectQueue(queue.id);
            } },
        ...{ class: "queue-select" },
        type: "button",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "queue-file-icon" },
        ...{ class: (`type-${queue.type}`) },
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_15 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "file",
        size: (17),
    }));
    const __VLS_16 = __VLS_15({
        name: "file",
        size: (17),
    }, ...__VLS_functionalComponentArgsRest(__VLS_15));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "queue-copy" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (queue.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
    (queue.tasks.filter((task) => task.completed).length);
    (queue.tasks.length);
    (queue.type);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.em, __VLS_intrinsicElements.em)({
        ...{ style: ({ width: `${__VLS_ctx.queueProgress(queue)}%` }) },
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_18 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "chevron-right",
        size: (15),
    }));
    const __VLS_19 = __VLS_18({
        name: "chevron-right",
        size: (15),
    }, ...__VLS_functionalComponentArgsRest(__VLS_18));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.requestDeleteQueue(queue);
            } },
        ...{ class: "queue-remove" },
        type: "button",
        'aria-label': (`删除队列 ${queue.name}`),
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "trash",
        size: (15),
    }));
    const __VLS_22 = __VLS_21({
        name: "trash",
        size: (15),
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
}
if (__VLS_ctx.queues.length && !__VLS_ctx.visibleQueues.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "sidebar-empty" },
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_24 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "search",
        size: (22),
    }));
    const __VLS_25 = __VLS_24({
        name: "search",
        size: (22),
    }, ...__VLS_functionalComponentArgsRest(__VLS_24));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
}
if (!__VLS_ctx.queues.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.openFilePicker) },
        ...{ class: "first-import" },
        type: "button",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_27 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "folder",
        size: (25),
    }));
    const __VLS_28 = __VLS_27({
        name: "folder",
        size: (25),
    }, ...__VLS_functionalComponentArgsRest(__VLS_27));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "sidebar-foot" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "storage-dot" },
});
if (__VLS_ctx.sidebarOpen) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.sidebarOpen))
                    return;
                __VLS_ctx.sidebarOpen = false;
            } },
        ...{ class: "sidebar-mask" },
        type: "button",
        'aria-label': "关闭队列列表",
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.main, __VLS_intrinsicElements.main)({
    ...{ class: "queue-main" },
});
if (__VLS_ctx.selectedQueue) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
        ...{ class: "queue-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "queue-heading" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.selectedQueue))
                    return;
                __VLS_ctx.sidebarOpen = true;
            } },
        ...{ class: "mobile-sidebar-trigger" },
        type: "button",
        'aria-label': "打开队列列表",
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_30 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "menu",
        size: (19),
    }));
    const __VLS_31 = __VLS_30({
        name: "menu",
        size: (19),
    }, ...__VLS_functionalComponentArgsRest(__VLS_30));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "header-file-icon" },
        ...{ class: (`type-${__VLS_ctx.selectedQueue.type}`) },
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "file",
        size: (20),
    }));
    const __VLS_34 = __VLS_33({
        name: "file",
        size: (20),
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "queue-title-line" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
    (__VLS_ctx.selectedQueue.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: (`type-${__VLS_ctx.selectedQueue.type}`) },
    });
    (__VLS_ctx.selectedQueue.type);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.selectedQueue.sourceName);
    (__VLS_ctx.formatUpdatedAt(__VLS_ctx.selectedQueue.updatedAt));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "header-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.selectedQueue))
                    return;
                __VLS_ctx.readerOpen = true;
            } },
        ...{ class: "text-button" },
        type: "button",
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_36 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "file",
        size: (16),
    }));
    const __VLS_37 = __VLS_36({
        name: "file",
        size: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_36));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.exportQueue) },
        ...{ class: "text-button" },
        type: "button",
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_39 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "download",
        size: (16),
    }));
    const __VLS_40 = __VLS_39({
        name: "download",
        size: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_39));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.openEditQueue) },
        ...{ class: "text-button" },
        type: "button",
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_42 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "edit",
        size: (16),
    }));
    const __VLS_43 = __VLS_42({
        name: "edit",
        size: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_42));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.openNewTask) },
        ...{ class: "add-task-button" },
        type: "button",
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "plus",
        size: (17),
    }));
    const __VLS_46 = __VLS_45({
        name: "plus",
        size: (17),
    }, ...__VLS_functionalComponentArgsRest(__VLS_45));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "main-content" },
    });
    if (__VLS_ctx.focusedHourTask) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "motivation-banner" },
            ...{ class: ({ completed: __VLS_ctx.focusedHourTask.completed }) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "motivation-spark" },
        });
        /** @type {[typeof BaseIcon, ]} */ ;
        // @ts-ignore
        const __VLS_48 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
            name: "spark",
            size: (28),
            strokeWidth: (2.2),
        }));
        const __VLS_49 = __VLS_48({
            name: "spark",
            size: (28),
            strokeWidth: (2.2),
        }, ...__VLS_functionalComponentArgsRest(__VLS_48));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "motivation-copy" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.focusedHourTask.time);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (__VLS_ctx.motivationForTask(__VLS_ctx.focusedHourTask));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        (__VLS_ctx.focusedHourTask.completed ? '这一小时已经漂亮拿下，带着这股力量继续前进！' : `当前目标：${__VLS_ctx.focusedHourTask.title}`);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "queue-hero" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "hero-kicker" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({});
    (__VLS_ctx.selectedQueue.type);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "progress-panel" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "progress-number" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.selectedProgress);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "progress-main" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "progress-labels" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.b, __VLS_intrinsicElements.b)({});
    (__VLS_ctx.selectedCompleted);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.b, __VLS_intrinsicElements.b)({});
    (__VLS_ctx.selectedTotal - __VLS_ctx.selectedCompleted);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "main-progress" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ style: ({ width: `${__VLS_ctx.selectedProgress}%` }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.selectedQueue.importMessage);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
        ...{ onSubmit: (__VLS_ctx.quickAddTask) },
        ...{ class: "quick-add-bar" },
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_51 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "plus",
        size: (19),
    }));
    const __VLS_52 = __VLS_51({
        name: "plus",
        size: (19),
    }, ...__VLS_functionalComponentArgsRest(__VLS_51));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        maxlength: "240",
        placeholder: "添加一项新任务…",
    });
    (__VLS_ctx.quickTaskTitle);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        type: "submit",
        disabled: (!__VLS_ctx.quickTaskTitle.trim()),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "tasks-section" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "tasks-toolbar" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "filter-tabs" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.selectedQueue))
                    return;
                __VLS_ctx.taskFilter = 'all';
            } },
        type: "button",
        ...{ class: ({ active: __VLS_ctx.taskFilter === 'all' }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.taskFilterCounts.all);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.selectedQueue))
                    return;
                __VLS_ctx.taskFilter = 'todo';
            } },
        type: "button",
        ...{ class: ({ active: __VLS_ctx.taskFilter === 'todo' }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.taskFilterCounts.todo);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.selectedQueue))
                    return;
                __VLS_ctx.taskFilter = 'done';
            } },
        type: "button",
        ...{ class: ({ active: __VLS_ctx.taskFilter === 'done' }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.taskFilterCounts.done);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "task-search" },
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_54 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "search",
        size: (16),
    }));
    const __VLS_55 = __VLS_54({
        name: "search",
        size: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_54));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "search",
        placeholder: "搜索当前队列",
    });
    (__VLS_ctx.taskSearch);
    if (__VLS_ctx.taskSearch) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.selectedQueue))
                        return;
                    if (!(__VLS_ctx.taskSearch))
                        return;
                    __VLS_ctx.taskSearch = '';
                } },
            type: "button",
            'aria-label': "清空搜索",
        });
        /** @type {[typeof BaseIcon, ]} */ ;
        // @ts-ignore
        const __VLS_57 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
            name: "close",
            size: (13),
        }));
        const __VLS_58 = __VLS_57({
            name: "close",
            size: (13),
        }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "expand-hint" },
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_60 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "chevron-down",
        size: (13),
    }));
    const __VLS_61 = __VLS_60({
        name: "chevron-down",
        size: (13),
    }, ...__VLS_functionalComponentArgsRest(__VLS_60));
    if (__VLS_ctx.filteredTasks.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "task-list" },
        });
        for (const [task] of __VLS_getVForSourceType((__VLS_ctx.filteredTasks))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.selectedQueue))
                            return;
                        if (!(__VLS_ctx.filteredTasks.length))
                            return;
                        __VLS_ctx.toggleExpanded(task.id);
                    } },
                ...{ onKeydown: (...[$event]) => {
                        if (!(__VLS_ctx.selectedQueue))
                            return;
                        if (!(__VLS_ctx.filteredTasks.length))
                            return;
                        __VLS_ctx.toggleExpanded(task.id);
                    } },
                key: (task.id),
                ...{ class: "simple-task" },
                ...{ class: ({ completed: task.completed, changed: __VLS_ctx.changedTaskId === task.id, 'hour-task': __VLS_ctx.isHourTask(task) }) },
                tabindex: "0",
                role: "button",
                'aria-expanded': (__VLS_ctx.expandedTaskId === task.id),
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "task-row-shell" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.selectedQueue))
                            return;
                        if (!(__VLS_ctx.filteredTasks.length))
                            return;
                        __VLS_ctx.toggleTask(task);
                    } },
                ...{ class: "complete-button" },
                type: "button",
                'aria-label': (task.completed ? '恢复为待完成' : '标记为已完成'),
            });
            if (task.completed) {
                /** @type {[typeof BaseIcon, ]} */ ;
                // @ts-ignore
                const __VLS_63 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
                    name: "check",
                    size: (15),
                    strokeWidth: (2.5),
                }));
                const __VLS_64 = __VLS_63({
                    name: "check",
                    size: (15),
                    strokeWidth: (2.5),
                }, ...__VLS_functionalComponentArgsRest(__VLS_63));
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.time, __VLS_intrinsicElements.time)({
                ...{ class: ({ empty: !task.time }) },
            });
            (task.time || '待安排');
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "simple-task-copy" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
            (task.title);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "expand-indicator" },
                ...{ class: ({ open: __VLS_ctx.expandedTaskId === task.id }) },
            });
            /** @type {[typeof BaseIcon, ]} */ ;
            // @ts-ignore
            const __VLS_66 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
                name: "chevron-down",
                size: (14),
            }));
            const __VLS_67 = __VLS_66({
                name: "chevron-down",
                size: (14),
            }, ...__VLS_functionalComponentArgsRest(__VLS_66));
            if (__VLS_ctx.isHourTask(task)) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                    ...{ class: "task-motivation" },
                });
                /** @type {[typeof BaseIcon, ]} */ ;
                // @ts-ignore
                const __VLS_69 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
                    name: "spark",
                    size: (14),
                }));
                const __VLS_70 = __VLS_69({
                    name: "spark",
                    size: (14),
                }, ...__VLS_functionalComponentArgsRest(__VLS_69));
                (__VLS_ctx.motivationForTask(task));
            }
            if (task.note) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
                (task.note);
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "task-row-actions" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.selectedQueue))
                            return;
                        if (!(__VLS_ctx.filteredTasks.length))
                            return;
                        __VLS_ctx.openEditTask(task);
                    } },
                type: "button",
                'aria-label': (`编辑任务 ${task.title}`),
            });
            /** @type {[typeof BaseIcon, ]} */ ;
            // @ts-ignore
            const __VLS_72 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
                name: "edit",
                size: (16),
            }));
            const __VLS_73 = __VLS_72({
                name: "edit",
                size: (16),
            }, ...__VLS_functionalComponentArgsRest(__VLS_72));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.selectedQueue))
                            return;
                        if (!(__VLS_ctx.filteredTasks.length))
                            return;
                        __VLS_ctx.requestDeleteTask(task);
                    } },
                ...{ class: "delete-action" },
                type: "button",
                'aria-label': (`删除任务 ${task.title}`),
            });
            /** @type {[typeof BaseIcon, ]} */ ;
            // @ts-ignore
            const __VLS_75 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
                name: "trash",
                size: (16),
            }));
            const __VLS_76 = __VLS_75({
                name: "trash",
                size: (16),
            }, ...__VLS_functionalComponentArgsRest(__VLS_75));
            if (__VLS_ctx.expandedTaskId === task.id) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ onClick: () => { } },
                    ...{ class: "task-details" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "details-heading" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                /** @type {[typeof BaseIcon, ]} */ ;
                // @ts-ignore
                const __VLS_78 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
                    name: "clock",
                    size: (14),
                }));
                const __VLS_79 = __VLS_78({
                    name: "clock",
                    size: (14),
                }, ...__VLS_functionalComponentArgsRest(__VLS_78));
                (task.time || '待安排');
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.selectedQueue))
                                return;
                            if (!(__VLS_ctx.filteredTasks.length))
                                return;
                            if (!(__VLS_ctx.expandedTaskId === task.id))
                                return;
                            __VLS_ctx.toggleExpanded(task.id);
                        } },
                    type: "button",
                });
                /** @type {[typeof BaseIcon, ]} */ ;
                // @ts-ignore
                const __VLS_81 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
                    name: "chevron-down",
                    size: (13),
                }));
                const __VLS_82 = __VLS_81({
                    name: "chevron-down",
                    size: (13),
                }, ...__VLS_functionalComponentArgsRest(__VLS_81));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "details-grid" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
                (task.title);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                if (task.details.length) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
                    for (const [detail] of __VLS_getVForSourceType((task.details))) {
                        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                            key: (detail),
                        });
                        (detail);
                    }
                }
                else {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                        ...{ class: "detail-placeholder" },
                    });
                }
                if (task.note) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "detail-source" },
                    });
                    /** @type {[typeof BaseIcon, ]} */ ;
                    // @ts-ignore
                    const __VLS_84 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
                        name: "file",
                        size: (13),
                    }));
                    const __VLS_85 = __VLS_84({
                        name: "file",
                        size: (13),
                    }, ...__VLS_functionalComponentArgsRest(__VLS_84));
                    (task.note);
                }
                if (__VLS_ctx.repeatLabelForTask(task)) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "detail-source" },
                    });
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                        ...{ class: "template-badge" },
                    });
                    /** @type {[typeof BaseIcon, ]} */ ;
                    // @ts-ignore
                    const __VLS_87 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
                        name: "refresh",
                        size: (12),
                    }));
                    const __VLS_88 = __VLS_87({
                        name: "refresh",
                        size: (12),
                    }, ...__VLS_functionalComponentArgsRest(__VLS_87));
                    (__VLS_ctx.repeatLabelForTask(task));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!(__VLS_ctx.selectedQueue))
                                    return;
                                if (!(__VLS_ctx.filteredTasks.length))
                                    return;
                                if (!(__VLS_ctx.expandedTaskId === task.id))
                                    return;
                                if (!(__VLS_ctx.repeatLabelForTask(task)))
                                    return;
                                __VLS_ctx.stopRepeat(task);
                            } },
                        type: "button",
                        ...{ class: "detail-edit-button" },
                        ...{ style: {} },
                    });
                    /** @type {[typeof BaseIcon, ]} */ ;
                    // @ts-ignore
                    const __VLS_90 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
                        name: "trash",
                        size: (13),
                    }));
                    const __VLS_91 = __VLS_90({
                        name: "trash",
                        size: (13),
                    }, ...__VLS_functionalComponentArgsRest(__VLS_90));
                }
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.selectedQueue))
                                return;
                            if (!(__VLS_ctx.filteredTasks.length))
                                return;
                            if (!(__VLS_ctx.expandedTaskId === task.id))
                                return;
                            __VLS_ctx.openEditTask(task);
                        } },
                    ...{ class: "detail-edit-button" },
                    type: "button",
                });
                /** @type {[typeof BaseIcon, ]} */ ;
                // @ts-ignore
                const __VLS_93 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
                    name: "edit",
                    size: (14),
                }));
                const __VLS_94 = __VLS_93({
                    name: "edit",
                    size: (14),
                }, ...__VLS_functionalComponentArgsRest(__VLS_93));
            }
        }
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "task-empty" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        /** @type {[typeof BaseIcon, ]} */ ;
        // @ts-ignore
        const __VLS_96 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
            name: (__VLS_ctx.selectedQueue.tasks.length ? 'search' : 'check'),
            size: (29),
        }));
        const __VLS_97 = __VLS_96({
            name: (__VLS_ctx.selectedQueue.tasks.length ? 'search' : 'check'),
            size: (29),
        }, ...__VLS_functionalComponentArgsRest(__VLS_96));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
        (__VLS_ctx.selectedQueue.tasks.length ? '没有匹配的任务' : '这个队列还没有任务');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        (__VLS_ctx.selectedQueue.tasks.length ? '换一个筛选条件或搜索词试试。' : '解析器没有把正文段落误当任务，你可以手动添加。');
        if (!__VLS_ctx.selectedQueue.tasks.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (__VLS_ctx.openNewTask) },
                ...{ class: "add-task-button" },
                type: "button",
            });
            /** @type {[typeof BaseIcon, ]} */ ;
            // @ts-ignore
            const __VLS_99 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
                name: "plus",
                size: (16),
            }));
            const __VLS_100 = __VLS_99({
                name: "plus",
                size: (16),
            }, ...__VLS_functionalComponentArgsRest(__VLS_99));
        }
    }
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "welcome-empty" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.selectedQueue))
                    return;
                __VLS_ctx.sidebarOpen = true;
            } },
        ...{ class: "mobile-sidebar-trigger welcome-menu" },
        type: "button",
        'aria-label': "打开队列列表",
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_102 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "menu",
        size: (19),
    }));
    const __VLS_103 = __VLS_102({
        name: "menu",
        size: (19),
    }, ...__VLS_functionalComponentArgsRest(__VLS_102));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "welcome-icon" },
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_105 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "folder",
        size: (36),
    }));
    const __VLS_106 = __VLS_105({
        name: "folder",
        size: (36),
    }, ...__VLS_functionalComponentArgsRest(__VLS_105));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "welcome-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.openFilePicker) },
        ...{ class: "add-task-button" },
        type: "button",
        disabled: (__VLS_ctx.isImporting),
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_108 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "upload",
        size: (17),
    }));
    const __VLS_109 = __VLS_108({
        name: "upload",
        size: (17),
    }, ...__VLS_functionalComponentArgsRest(__VLS_108));
    (__VLS_ctx.isImporting ? '正在导入…' : '选择计划文件');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.openNewQueue) },
        ...{ class: "text-button" },
        type: "button",
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_111 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "plus",
        size: (16),
    }));
    const __VLS_112 = __VLS_111({
        name: "plus",
        size: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_111));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onChange: (__VLS_ctx.onFileInput) },
    ref: "fileInput",
    ...{ class: "visually-hidden" },
    type: "file",
    accept: ".md,.markdown,.txt,text/markdown,text/plain",
    multiple: true,
});
/** @type {typeof __VLS_ctx.fileInput} */ ;
const __VLS_114 = {}.Transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
// @ts-ignore
const __VLS_115 = __VLS_asFunctionalComponent(__VLS_114, new __VLS_114({
    name: "fade",
}));
const __VLS_116 = __VLS_115({
    name: "fade",
}, ...__VLS_functionalComponentArgsRest(__VLS_115));
__VLS_117.slots.default;
if (__VLS_ctx.isDragging) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "drop-layer" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_118 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "upload",
        size: (34),
    }));
    const __VLS_119 = __VLS_118({
        name: "upload",
        size: (34),
    }, ...__VLS_functionalComponentArgsRest(__VLS_118));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
}
var __VLS_117;
const __VLS_121 = {}.Transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
// @ts-ignore
const __VLS_122 = __VLS_asFunctionalComponent(__VLS_121, new __VLS_121({
    name: "modal",
}));
const __VLS_123 = __VLS_122({
    name: "modal",
}, ...__VLS_functionalComponentArgsRest(__VLS_122));
__VLS_124.slots.default;
if (__VLS_ctx.modalMode) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onMousedown: (...[$event]) => {
                if (!(__VLS_ctx.modalMode))
                    return;
                __VLS_ctx.modalMode = null;
            } },
        ...{ class: "modal-layer" },
    });
    if (__VLS_ctx.modalMode === 'task') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
            ...{ onSubmit: (__VLS_ctx.saveTask) },
            ...{ class: "simple-modal" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "modal-title" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.editingTaskId ? 'EDIT TASK' : 'NEW TASK');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
        (__VLS_ctx.editingTaskId ? '编辑任务' : '添加任务');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.modalMode))
                        return;
                    if (!(__VLS_ctx.modalMode === 'task'))
                        return;
                    __VLS_ctx.modalMode = null;
                } },
            type: "button",
            'aria-label': "关闭",
        });
        /** @type {[typeof BaseIcon, ]} */ ;
        // @ts-ignore
        const __VLS_125 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
            name: "close",
            size: (18),
        }));
        const __VLS_126 = __VLS_125({
            name: "close",
            size: (18),
        }, ...__VLS_functionalComponentArgsRest(__VLS_125));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            autofocus: true,
            maxlength: "240",
            placeholder: "要完成什么？",
        });
        (__VLS_ctx.taskDraft.title);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            maxlength: "20",
            placeholder: "例如：08:30",
        });
        (__VLS_ctx.taskDraft.time);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)({
            value: (__VLS_ctx.taskDraft.note),
            rows: "3",
            maxlength: "300",
            placeholder: "补充说明、材料或目标",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)({
            value: (__VLS_ctx.taskDraft.details),
            rows: "6",
            maxlength: "3000",
            placeholder: "\u4f8b\u5982\uff1a\u005c\u006e\u0031\u002e\u0020\u5148\u770b\u7b2c\u0020\u0033\u0020\u8282\u89c6\u9891\u005c\u006e\u0032\u002e\u0020\u5b8c\u6210\u8bfe\u540e\u7ec3\u4e60\u005c\u006e\u0033\u002e\u0020\u8bb0\u5f55\u0020\u0033\u0020\u4e2a\u7591\u95ee",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
            value: (__VLS_ctx.taskDraft.repeat),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "none",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "daily",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "weekly",
        });
        if (__VLS_ctx.taskDraft.repeat === 'weekly') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "repeat-weekdays" },
            });
            for (const [option] of __VLS_getVForSourceType((__VLS_ctx.weekdayOptions))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.modalMode))
                                return;
                            if (!(__VLS_ctx.modalMode === 'task'))
                                return;
                            if (!(__VLS_ctx.taskDraft.repeat === 'weekly'))
                                return;
                            __VLS_ctx.toggleWeekday(option.value);
                        } },
                    key: (option.value),
                    type: "button",
                    ...{ class: ({ active: __VLS_ctx.taskDraft.weekdays.includes(option.value) }) },
                });
                (option.label);
            }
        }
        if (__VLS_ctx.taskDraft.repeat !== 'none') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "repeat-hint" },
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "modal-buttons" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.modalMode))
                        return;
                    if (!(__VLS_ctx.modalMode === 'task'))
                        return;
                    __VLS_ctx.modalMode = null;
                } },
            ...{ class: "cancel-button" },
            type: "button",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ class: "save-button" },
            type: "submit",
            disabled: (!__VLS_ctx.taskDraft.title.trim() || (__VLS_ctx.taskDraft.repeat === 'weekly' && !__VLS_ctx.taskDraft.weekdays.length)),
        });
        /** @type {[typeof BaseIcon, ]} */ ;
        // @ts-ignore
        const __VLS_128 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
            name: "check",
            size: (16),
        }));
        const __VLS_129 = __VLS_128({
            name: "check",
            size: (16),
        }, ...__VLS_functionalComponentArgsRest(__VLS_128));
        (__VLS_ctx.editingTaskId ? '保存修改' : '添加任务');
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
            ...{ onSubmit: (__VLS_ctx.saveQueue) },
            ...{ class: "simple-modal" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "modal-title" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.editingQueueId ? 'EDIT QUEUE' : 'NEW QUEUE');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
        (__VLS_ctx.editingQueueId ? '编辑队列' : '新建空队列');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.modalMode))
                        return;
                    if (!!(__VLS_ctx.modalMode === 'task'))
                        return;
                    __VLS_ctx.modalMode = null;
                } },
            type: "button",
            'aria-label': "关闭",
        });
        /** @type {[typeof BaseIcon, ]} */ ;
        // @ts-ignore
        const __VLS_131 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
            name: "close",
            size: (18),
        }));
        const __VLS_132 = __VLS_131({
            name: "close",
            size: (18),
        }, ...__VLS_functionalComponentArgsRest(__VLS_131));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            autofocus: true,
            maxlength: "80",
            placeholder: "例如：英语学习计划",
        });
        (__VLS_ctx.queueDraft.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
            value: (__VLS_ctx.queueDraft.type),
        });
        for (const [type] of __VLS_getVForSourceType((__VLS_ctx.queueTypes))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                key: (type),
                value: (type),
            });
            (type);
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "modal-buttons" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.modalMode))
                        return;
                    if (!!(__VLS_ctx.modalMode === 'task'))
                        return;
                    __VLS_ctx.modalMode = null;
                } },
            ...{ class: "cancel-button" },
            type: "button",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ class: "save-button" },
            type: "submit",
            disabled: (!__VLS_ctx.queueDraft.name.trim()),
        });
        /** @type {[typeof BaseIcon, ]} */ ;
        // @ts-ignore
        const __VLS_134 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
            name: "check",
            size: (16),
        }));
        const __VLS_135 = __VLS_134({
            name: "check",
            size: (16),
        }, ...__VLS_functionalComponentArgsRest(__VLS_134));
        (__VLS_ctx.editingQueueId ? '保存队列' : '创建队列');
    }
}
var __VLS_124;
const __VLS_137 = {}.Transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
// @ts-ignore
const __VLS_138 = __VLS_asFunctionalComponent(__VLS_137, new __VLS_137({
    name: "modal",
}));
const __VLS_139 = __VLS_138({
    name: "modal",
}, ...__VLS_functionalComponentArgsRest(__VLS_138));
__VLS_140.slots.default;
if (__VLS_ctx.confirmTarget) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onMousedown: (...[$event]) => {
                if (!(__VLS_ctx.confirmTarget))
                    return;
                __VLS_ctx.confirmTarget = null;
            } },
        ...{ class: "modal-layer" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "confirm-modal" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "confirm-icon" },
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_141 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "trash",
        size: (21),
    }));
    const __VLS_142 = __VLS_141({
        name: "trash",
        size: (21),
    }, ...__VLS_functionalComponentArgsRest(__VLS_141));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (__VLS_ctx.confirmTarget.kind === 'queue' ? '这个队列' : '这个任务');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.confirmTarget.name);
    (__VLS_ctx.confirmTarget.kind === 'queue' ? '及其中的全部任务' : '');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-buttons" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.confirmTarget))
                    return;
                __VLS_ctx.confirmTarget = null;
            } },
        ...{ class: "cancel-button" },
        type: "button",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.confirmDelete) },
        ...{ class: "danger-button" },
        type: "button",
    });
}
var __VLS_140;
const __VLS_144 = {}.Transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
// @ts-ignore
const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
    name: "reader",
}));
const __VLS_146 = __VLS_145({
    name: "reader",
}, ...__VLS_functionalComponentArgsRest(__VLS_145));
__VLS_147.slots.default;
if (__VLS_ctx.readerOpen && __VLS_ctx.selectedQueue) {
    /** @type {[typeof ReaderOverlay, ]} */ ;
    // @ts-ignore
    const __VLS_148 = __VLS_asFunctionalComponent(ReaderOverlay, new ReaderOverlay({
        ...{ 'onClose': {} },
        queueId: (__VLS_ctx.selectedQueue.id),
        title: (__VLS_ctx.selectedQueue.name),
        source: (__VLS_ctx.selectedQueue.rawContent ?? ''),
    }));
    const __VLS_149 = __VLS_148({
        ...{ 'onClose': {} },
        queueId: (__VLS_ctx.selectedQueue.id),
        title: (__VLS_ctx.selectedQueue.name),
        source: (__VLS_ctx.selectedQueue.rawContent ?? ''),
    }, ...__VLS_functionalComponentArgsRest(__VLS_148));
    let __VLS_151;
    let __VLS_152;
    let __VLS_153;
    const __VLS_154 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.readerOpen && __VLS_ctx.selectedQueue))
                return;
            __VLS_ctx.readerOpen = false;
        }
    };
    var __VLS_150;
}
var __VLS_147;
const __VLS_155 = {}.Transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
// @ts-ignore
const __VLS_156 = __VLS_asFunctionalComponent(__VLS_155, new __VLS_155({
    name: "toast",
}));
const __VLS_157 = __VLS_156({
    name: "toast",
}, ...__VLS_functionalComponentArgsRest(__VLS_156));
__VLS_158.slots.default;
if (__VLS_ctx.toast.visible) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "action-toast" },
        ...{ class: (__VLS_ctx.toast.tone) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_159 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: (__VLS_ctx.toast.tone === 'success' ? 'check' : 'inbox'),
        size: (16),
    }));
    const __VLS_160 = __VLS_159({
        name: (__VLS_ctx.toast.tone === 'success' ? 'check' : 'inbox'),
        size: (16),
    }, ...__VLS_functionalComponentArgsRest(__VLS_159));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.toast.title);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
    (__VLS_ctx.toast.detail);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.toast.visible))
                    return;
                __VLS_ctx.toast.visible = false;
            } },
        type: "button",
        'aria-label': "关闭提示",
    });
    /** @type {[typeof BaseIcon, ]} */ ;
    // @ts-ignore
    const __VLS_162 = __VLS_asFunctionalComponent(BaseIcon, new BaseIcon({
        name: "close",
        size: (14),
    }));
    const __VLS_163 = __VLS_162({
        name: "close",
        size: (14),
    }, ...__VLS_functionalComponentArgsRest(__VLS_162));
}
var __VLS_158;
/** @type {__VLS_StyleScopedClasses['queue-app']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-brand']} */ ;
/** @type {__VLS_StyleScopedClasses['simple-logo']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-close']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['import-button']} */ ;
/** @type {__VLS_StyleScopedClasses['new-queue-button']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-search']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-list']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-list-item']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-select']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-file-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-remove']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['first-import']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-foot']} */ ;
/** @type {__VLS_StyleScopedClasses['storage-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['sidebar-mask']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-main']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-header']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-heading']} */ ;
/** @type {__VLS_StyleScopedClasses['mobile-sidebar-trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['header-file-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-title-line']} */ ;
/** @type {__VLS_StyleScopedClasses['header-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['text-button']} */ ;
/** @type {__VLS_StyleScopedClasses['text-button']} */ ;
/** @type {__VLS_StyleScopedClasses['text-button']} */ ;
/** @type {__VLS_StyleScopedClasses['add-task-button']} */ ;
/** @type {__VLS_StyleScopedClasses['main-content']} */ ;
/** @type {__VLS_StyleScopedClasses['motivation-banner']} */ ;
/** @type {__VLS_StyleScopedClasses['motivation-spark']} */ ;
/** @type {__VLS_StyleScopedClasses['motivation-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-hero']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-kicker']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-number']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-main']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-labels']} */ ;
/** @type {__VLS_StyleScopedClasses['main-progress']} */ ;
/** @type {__VLS_StyleScopedClasses['quick-add-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['tasks-section']} */ ;
/** @type {__VLS_StyleScopedClasses['tasks-toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['task-search']} */ ;
/** @type {__VLS_StyleScopedClasses['expand-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['task-list']} */ ;
/** @type {__VLS_StyleScopedClasses['simple-task']} */ ;
/** @type {__VLS_StyleScopedClasses['task-row-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['complete-button']} */ ;
/** @type {__VLS_StyleScopedClasses['simple-task-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['expand-indicator']} */ ;
/** @type {__VLS_StyleScopedClasses['task-motivation']} */ ;
/** @type {__VLS_StyleScopedClasses['task-row-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['delete-action']} */ ;
/** @type {__VLS_StyleScopedClasses['task-details']} */ ;
/** @type {__VLS_StyleScopedClasses['details-heading']} */ ;
/** @type {__VLS_StyleScopedClasses['details-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-placeholder']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-source']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-source']} */ ;
/** @type {__VLS_StyleScopedClasses['template-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-edit-button']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-edit-button']} */ ;
/** @type {__VLS_StyleScopedClasses['task-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['add-task-button']} */ ;
/** @type {__VLS_StyleScopedClasses['welcome-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['mobile-sidebar-trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['welcome-menu']} */ ;
/** @type {__VLS_StyleScopedClasses['welcome-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['welcome-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['add-task-button']} */ ;
/** @type {__VLS_StyleScopedClasses['text-button']} */ ;
/** @type {__VLS_StyleScopedClasses['visually-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['drop-layer']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-layer']} */ ;
/** @type {__VLS_StyleScopedClasses['simple-modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-title']} */ ;
/** @type {__VLS_StyleScopedClasses['repeat-weekdays']} */ ;
/** @type {__VLS_StyleScopedClasses['repeat-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-buttons']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-button']} */ ;
/** @type {__VLS_StyleScopedClasses['save-button']} */ ;
/** @type {__VLS_StyleScopedClasses['simple-modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-title']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-buttons']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-button']} */ ;
/** @type {__VLS_StyleScopedClasses['save-button']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-layer']} */ ;
/** @type {__VLS_StyleScopedClasses['confirm-modal']} */ ;
/** @type {__VLS_StyleScopedClasses['confirm-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-buttons']} */ ;
/** @type {__VLS_StyleScopedClasses['cancel-button']} */ ;
/** @type {__VLS_StyleScopedClasses['danger-button']} */ ;
/** @type {__VLS_StyleScopedClasses['action-toast']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            BaseIcon: BaseIcon,
            ReaderOverlay: ReaderOverlay,
            queueTypes: queueTypes,
            weekdayOptions: weekdayOptions,
            queues: queues,
            selectedQueueId: selectedQueueId,
            queueSearch: queueSearch,
            taskSearch: taskSearch,
            quickTaskTitle: quickTaskTitle,
            taskFilter: taskFilter,
            fileInput: fileInput,
            isImporting: isImporting,
            isDragging: isDragging,
            sidebarOpen: sidebarOpen,
            changedTaskId: changedTaskId,
            expandedTaskId: expandedTaskId,
            readerOpen: readerOpen,
            modalMode: modalMode,
            editingTaskId: editingTaskId,
            editingQueueId: editingQueueId,
            taskDraft: taskDraft,
            queueDraft: queueDraft,
            confirmTarget: confirmTarget,
            toast: toast,
            selectedQueue: selectedQueue,
            visibleQueues: visibleQueues,
            queueTaskCount: queueTaskCount,
            queueCompletedCount: queueCompletedCount,
            selectedCompleted: selectedCompleted,
            selectedTotal: selectedTotal,
            selectedProgress: selectedProgress,
            focusedHourTask: focusedHourTask,
            filteredTasks: filteredTasks,
            taskFilterCounts: taskFilterCounts,
            isHourTask: isHourTask,
            motivationForTask: motivationForTask,
            queueProgress: queueProgress,
            selectQueue: selectQueue,
            toggleTask: toggleTask,
            toggleExpanded: toggleExpanded,
            quickAddTask: quickAddTask,
            openNewTask: openNewTask,
            openEditTask: openEditTask,
            toggleWeekday: toggleWeekday,
            repeatLabelForTask: repeatLabelForTask,
            stopRepeat: stopRepeat,
            saveTask: saveTask,
            openNewQueue: openNewQueue,
            openEditQueue: openEditQueue,
            saveQueue: saveQueue,
            requestDeleteTask: requestDeleteTask,
            requestDeleteQueue: requestDeleteQueue,
            confirmDelete: confirmDelete,
            openFilePicker: openFilePicker,
            onFileInput: onFileInput,
            onDragEnter: onDragEnter,
            onDragLeave: onDragLeave,
            onDrop: onDrop,
            exportQueue: exportQueue,
            formatUpdatedAt: formatUpdatedAt,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
