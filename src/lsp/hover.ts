import * as vscode from 'vscode'
import { logger } from '../utils/logger'
import { getDocument } from './tools'

interface SerializableHover {
  contents: string[]
  range?: {
    start: { line: number, character: number }
    end: { line: number, character: number }
  }
}

/**
 * 提取 MarkdownString 或 MarkedString 的文本内容
 */
function extractContentValue(content: vscode.MarkdownString | vscode.MarkedString): string {
  if (typeof content === 'string') {
    return content
  }
  if (content instanceof vscode.MarkdownString) {
    return content.value
  }
  // MarkedString with language
  if ('language' in content && 'value' in content) {
    return `\`\`\`${content.language}\n${content.value}\n\`\`\``
  }
  return String(content)
}

/**
 * 获取指定位置的悬停信息
 *
 * @param uri 文档URI
 * @param line 行号（从0开始）
 * @param character 字符位置（从0开始）
 * @returns 悬停信息对象
 */
export async function getHover(
  uri: string,
  line: number,
  character: number,
): Promise<SerializableHover[]> {
  try {
    const document = await getDocument(uri)
    if (!document) {
      throw new Error(`无法找到文档: ${uri}`)
    }

    const position = new vscode.Position(line, character)

    logger.info(`获取悬停信息: ${uri} 行:${line} 列:${character}`)

    // 调用VSCode API获取悬停信息
    const hoverResults = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      document.uri,
      position,
    )

    if (!hoverResults) {
      return []
    }

    // 转换为可序列化的格式
    return hoverResults.map((hover) => {
      const contents = Array.isArray(hover.contents)
        ? hover.contents.map(extractContentValue)
        : [extractContentValue(hover.contents)]

      const result: SerializableHover = { contents }

      if (hover.range) {
        result.range = {
          start: { line: hover.range.start.line, character: hover.range.start.character },
          end: { line: hover.range.end.line, character: hover.range.end.character },
        }
      }

      return result
    })
  }
  catch (error) {
    logger.error('获取悬停信息失败', error)
    throw error
  }
}
