/**
 * 笔记导出前的格式化纯函数。
 *
 * @bdd EF-NAME-002 纯函数从组件中抽离到工具层（保证可独立单测）
 * 用于「小记模式」右侧笔记导出为 .md 前，对内容做统一整理：
 *  - 去除每行行尾多余空格
 *  - 折叠连续多余空格为单个（不动行首缩进）
 *  - 连续 3 行以上空行压缩为最多 1 个空行，段落间距保持一致
 *  - 去掉全文首尾空白
 */
export declare function formatNote(raw: string): string;
/**
 * 生成笔记导出文件名：`{队列名}-笔记.md`。
 * 会剔除文件系统非法字符，空名兜底为「未命名」。
 */
export declare function noteFileName(queueName: string): string;
