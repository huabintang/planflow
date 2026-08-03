/**
 * 与视图无关的任务时间纯函数集合。
 *
 * @bdd EF-NAME-002 纯函数从组件中抽离到工具层
 * 这些函数原先内联在 App.vue，现抽离到 utils 层以便独立单测与复用。
 */
/**
 * 把任务时间转换为“分钟”用于排序。
 * - `Hxxx` 小时编号：小时 * 60
 * - `HH:MM` 时钟：小时 * 60 + 分钟
 * - 其他（未安排）：1440，排到最后
 *
 * @bdd EF-PARSE-005 时间格式被规范化（排序侧）
 */
export function timeToMinutes(time) {
    const hourCode = time.match(/^H(\d{1,3})$/i);
    if (hourCode)
        return Number(hourCode[1]) * 60;
    const match = time.match(/^(\d{2}):(\d{2})$/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : 1440;
}
/**
 * 规范化用户手输的时间。
 * - `H1` → `H001`
 * - `8:5` 不合法则原样截断
 * - `08:30` → `08:30`
 *
 * @bdd EF-PARSE-005 时间格式被规范化（输入侧）
 */
export function normalizeTaskTime(time) {
    const value = time.trim();
    const hourCode = value.match(/^H\s*(\d{1,3})$/i);
    if (hourCode)
        return `H${String(Number(hourCode[1])).padStart(3, '0')}`;
    const clock = value.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    return clock ? `${clock[1].padStart(2, '0')}:${clock[2]}` : value.slice(0, 20);
}
/** 判断任务是否为小时任务（time 为 Hxxx）。 */
export function isHourTaskTime(time) {
    return /^H\d{1,3}$/i.test(time);
}
/**
 * 根据小时编号选取对应励志语。列表循环使用。
 *
 * @bdd EF-NAME-002 纯函数从组件中抽离到工具层
 */
export function motivationForTime(time, motivations) {
    if (!motivations.length)
        return '';
    const match = time.match(/^H(\d{1,3})$/i);
    const hour = match ? Number(match[1]) : 1;
    return motivations[(Math.max(1, hour) - 1) % motivations.length];
}
