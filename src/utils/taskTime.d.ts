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
export declare function timeToMinutes(time: string): number;
/**
 * 规范化用户手输的时间。
 * - `H1` → `H001`
 * - `8:5` 不合法则原样截断
 * - `08:30` → `08:30`
 *
 * @bdd EF-PARSE-005 时间格式被规范化（输入侧）
 */
export declare function normalizeTaskTime(time: string): string;
/** 判断任务是否为小时任务（time 为 Hxxx）。 */
export declare function isHourTaskTime(time: string): boolean;
/**
 * 根据小时编号选取对应励志语。列表循环使用。
 *
 * @bdd EF-NAME-002 纯函数从组件中抽离到工具层
 */
export declare function motivationForTime(time: string, motivations: readonly string[]): string;
