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
export function formatNote(raw: string): string {
  if (!raw) return ''

  const lines = raw.replace(/\r\n?/g, '\n').split('\n')

  const cleaned = lines.map((line) => {
    // 保留行首缩进，压缩中间和行尾的多余空格
    const leading = line.match(/^[\t ]*/)?.[0] ?? ''
    const body = line
      .slice(leading.length)
      .replace(/[ \t]+/g, ' ')
      .replace(/[ \t]+$/g, '')
    return (leading + body).replace(/[ \t]+$/g, '')
  })

  // 折叠连续空行：多个空行 → 最多 1 个空行
  const collapsed: string[] = []
  let blankRun = 0
  for (const line of cleaned) {
    if (line.trim() === '') {
      blankRun += 1
      if (blankRun <= 1) collapsed.push('')
    } else {
      blankRun = 0
      collapsed.push(line)
    }
  }

  return collapsed.join('\n').trim()
}

/**
 * 生成笔记导出文件名：`{队列名}-笔记.md`。
 * 会剔除文件系统非法字符，空名兜底为「未命名」。
 */
export function noteFileName(queueName: string): string {
  const base = (queueName ?? '').trim().replace(/[\\/:*?"<>|]/g, '').trim() || '未命名'
  return `${base}-笔记.md`
}
