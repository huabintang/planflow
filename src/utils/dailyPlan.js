/** 返回本地时区下的 YYYY-MM-DD。传入 Date，避免在纯函数里隐式读时钟。 */
export function toDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
/** 判断某个重复规则在指定星期几是否需要排任务。 */
export function repeatMatches(repeat, weekday) {
    if (repeat.kind === 'daily')
        return true;
    return repeat.days.includes(weekday);
}
const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
/** 人类可读的重复描述，例如“每天”“周一、周三、周五”。 */
export function describeRepeat(repeat) {
    if (repeat.kind === 'daily')
        return '每天';
    if (!repeat.days.length)
        return '未选择日期';
    const ordered = [...new Set(repeat.days)].sort((a, b) => a - b);
    if (ordered.length === 7)
        return '每天';
    if (ordered.length === 5 && ordered.every((d) => d >= 1 && d <= 5))
        return '工作日';
    if (ordered.length === 2 && ordered.includes(0) && ordered.includes(6))
        return '周末';
    return ordered.map((d) => WEEKDAY_LABELS[d]).join('、');
}
/**
 * 为指定日期生成缺失的每日任务。
 * 纯函数：只根据传入的 templates、已有 tasks 和目标日期计算，不读时钟、不产生副作用。
 * - 只生成“今天”（由调用方传入 date）匹配的模板任务。
 * - 通过 templateId + planDate 去重：已生成过的不再重复生成。
 * - 生成的任务不带 time（不参与小时排列），completed 一律为 false，由用户自行勾选。
 */
export function generateDailyTasks(templates, existingTasks, date, createId) {
    const dateKey = toDateKey(date);
    const weekday = date.getDay();
    const existingKeys = new Set(existingTasks
        .filter((task) => task.templateId && task.planDate)
        .map((task) => `${task.templateId}|${task.planDate}`));
    const generated = [];
    templates.forEach((template) => {
        if (!repeatMatches(template.repeat, weekday))
            return;
        const key = `${template.id}|${dateKey}`;
        if (existingKeys.has(key))
            return;
        existingKeys.add(key);
        const now = date.toISOString();
        generated.push({
            id: createId('task'),
            title: template.title,
            completed: false,
            time: '',
            note: template.note,
            details: [...template.details],
            createdAt: now,
            updatedAt: now,
            templateId: template.id,
            planDate: dateKey,
        });
    });
    return generated;
}
