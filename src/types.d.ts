export type QueueType = '学习' | '工作' | '生活' | '运动' | '其他';
export type TaskFilter = 'all' | 'todo' | 'done';
export interface QueueTask {
    id: string;
    title: string;
    completed: boolean;
    time: string;
    note: string;
    details: string[];
    createdAt: string;
    updatedAt: string;
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
}
export interface ParseResult {
    queue: TaskQueue;
    recognized: number;
    ignored: number;
    truncated: boolean;
}
