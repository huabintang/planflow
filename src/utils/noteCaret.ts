/**
 * 笔记 textarea「点击空白行 → 自动补空行」的纯计算逻辑。
 *
 * @bdd EF-NAME-002 纯函数从组件中抽离到工具层（保证可独立单测）
 *
 * 交互目标：用户在 textarea 下方空白横线处点击时，若当前文本行数不足以
 * 覆盖被点击的那一行，则向文本末尾补足空行，使光标能落在被点击的那一行
 * —— 像真正的记事本。
 *
 * 本模块只负责「算」，不触碰 DOM：由组件负责取坐标 / computedStyle，
 * 把结果传进来，再把返回值应用回数据层（noteContent）。
 */

export interface BlankLineInput {
  /** 点击点相对 textarea 内容顶部的 Y（像素，已减去 padding-top、已加上 scrollTop） */
  offsetY: number
  /** 单行高度（像素）= fontSize × line-height，建议由 getComputedStyle 得到 */
  lineHeightPx: number
  /** 当前 textarea 文本内容 */
  value: string
}

export interface BlankLineResult {
  /** 需要向末尾追加的 `\n` 个数（0 表示无需补行） */
  linesToAppend: number
  /** 补行后光标应落到的字符位置（selectionStart/End） */
  caretPos: number
}

/**
 * 计算点击空白行时需要补足的空行数与目标光标位置。
 *
 * 规则：
 *  - lineHeightPx <= 0 时视为无效输入，返回不补行、光标置于末尾（防除零）。
 *  - 被点击行号（0-based）< 现有行数时，说明点在已有文本范围内，交给浏览器
 *    原生定位，返回不补行、caretPos = -1（组件据此不干预光标）。
 *  - 否则补足 `目标行号 + 1 - 现有行数` 个空行，光标落到新末尾。
 */
export function computeBlankLineInsertion(input: BlankLineInput): BlankLineResult {
  const { offsetY, lineHeightPx, value } = input

  if (!Number.isFinite(lineHeightPx) || lineHeightPx <= 0) {
    return { linesToAppend: 0, caretPos: value.length }
  }

  const clickedLine = Math.max(0, Math.floor(offsetY / lineHeightPx)) // 0-based 目标行
  const currentLines = value.length ? value.split('\n').length : 0

  // 点在已有文本范围内 → 让浏览器原生定位，组件不干预
  if (clickedLine < currentLines) {
    return { linesToAppend: 0, caretPos: -1 }
  }

  const linesToAppend = clickedLine + 1 - currentLines
  const caretPos = value.length + linesToAppend
  return { linesToAppend, caretPos }
}
