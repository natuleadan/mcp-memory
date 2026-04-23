const MAX_CHARS = 1800

export function chunkCode(content: string): string[] {
  const BLOCK_START =
    /^(export\s+)?(async\s+)?(function|class|const\s+\w+\s*=|type\s+\w+|interface\s+\w+|enum\s+\w+)/
  const lines = content.split('\n')
  const chunks: string[] = []
  let current: string[] = []

  const flush = () => {
    const text = current.join('\n').trim()
    if (text.length >= 30) chunks.push(text)
    current = []
  }

  for (const line of lines) {
    if (BLOCK_START.test(line) && current.length > 0) {
      if (current.join('\n').length + line.length > MAX_CHARS) flush()
    }
    current.push(line)
    if (current.join('\n').length > MAX_CHARS) flush()
  }
  flush()
  return chunks
}

export function chunkParagraphs(content: string): string[] {
  const paragraphs = content.split(/\n{2,}/)
  const chunks: string[] = []
  let current = ''
  for (const p of paragraphs) {
    if (current.length + p.length > MAX_CHARS && current.length > 0) {
      chunks.push(current.trim())
      current = p
    } else {
      current += '\n\n' + p
    }
  }
  if (current.trim().length >= 30) chunks.push(current.trim())
  return chunks
}
