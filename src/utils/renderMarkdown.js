import DOMPurify from 'dompurify';
import { marked } from 'marked';
/**
 * 将 Markdown 原文渲染为可安全插入 DOM 的富文本 HTML。
 *
 * 流程：marked 解析 Markdown → HTML，再交给 DOMPurify 清洗，
 * 移除脚本、事件属性等潜在 XSS 载荷（因为最终会通过 v-html 注入）。
 */
// GitHub 风格换行：单个回车即换行，符合大多数用户对计划文件的直觉。
marked.setOptions({ gfm: true, breaks: true });
export function renderMarkdown(source) {
    const raw = (source ?? '').trim();
    if (!raw)
        return '';
    // marked.parse 在默认配置下同步返回 string。
    const html = marked.parse(raw);
    return DOMPurify.sanitize(html, {
        // 明确禁止 script/style，允许常见排版标签与安全的链接/图片属性。
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'style'],
        ALLOW_DATA_ATTR: false,
    });
}
