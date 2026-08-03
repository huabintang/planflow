export type QueueType = '学习' | '工作' | '生活' | '运动' | '其他';
export type TaskFilter = 'all' | 'todo' | 'done';
/** 0 = 周日, 1 = 周一 … 6 = 周六，与 JS Date.getDay() 对齐。 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
/**
 * 每日计划模板的重复规则。
 * - daily：每天都排
 * - weekly：仅在 days 指定的星期几排
 */
export interface RepeatRule {
    kind: 'daily' | 'weekly';
    /** kind === 'weekly' 时生效，取值 0–6；daily 时忽略。 */
    days: Weekday[];
}
/**
 * 每日计划模板：用户设定“每天/每周某几天要做的事”，
 * 到了对应日期由 generateDailyTasks 生成当天的普通任务。
 */
export interface DailyTemplate {
    id: string;
    title: string;
    note: string;
    details: string[];
    repeat: RepeatRule;
    createdAt: string;
    updatedAt: string;
}
export interface QueueTask {
    id: string;
    title: string;
    completed: boolean;
    time: string;
    note: string;
    details: string[];
    createdAt: string;
    updatedAt: string;
    /** 由每日模板生成时，记录来源模板 id 与生成日期（YYYY-MM-DD），用于去重与追溯。 */
    templateId?: string;
    planDate?: string;
}
export interface TaskQueue {
    id: string;
    name: string;
    sourceName: string;
    type: QueueType;
    tasks: QueueTask[];
    createdAt: string;
    updatedAt: string;
    importMessage: string;
    /** 导入时保留的原始 Markdown 全文，供全屏阅读器渲染；手动创建或旧数据可能为空。 */
    rawContent?: string;
    /** 该队列的每日计划模板；仅“每日计划”类队列会用到，旧数据可能为空。 */
    templates?: DailyTemplate[];
}
export interface ParseResult {
    queue: TaskQueue;
    recognized: number;
    ignored: number;
    truncated: boolean;
}
