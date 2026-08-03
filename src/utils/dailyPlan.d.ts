import type { DailyTemplate, QueueTask, RepeatRule, Weekday } from '../types';
/** 返回本地时区下的 YYYY-MM-DD。传入 Date，避免在纯函数里隐式读时钟。 */
export declare function toDateKey(date: Date): string;
/** 判断某个重复规则在指定星期几是否需要排任务。 */
export declare function repeatMatches(repeat: RepeatRule, weekday: Weekday): boolean;
/** 人类可读的重复描述，例如“每天”“周一、周三、周五”。 */
export declare function describeRepeat(repeat: RepeatRule): string;
/**
 * 为指定日期生成缺失的每日任务。
 * 纯函数：只根据传入的 templates、已有 tasks 和目标日期计算，不读时钟、不产生副作用。
 * - 只生成“今天”（由调用方传入 date）匹配的模板任务。
 * - 通过 templateId + planDate 去重：已生成过的不再重复生成。
 * - 生成的任务不带 time（不参与小时排列），completed 一律为 false，由用户自行勾选。
 */
export declare function generateDailyTasks(templates: DailyTemplate[], existingTasks: QueueTask[], date: Date, createId: (prefix: string) => string): QueueTask[];
