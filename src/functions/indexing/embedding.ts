import { execSync, spawn } from 'child_process'
import { Ollama } from 'ollama'

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
const ollama = new Ollama({ host: OLLAMA_HOST })

function isOllamaRunning(): boolean {
  try {
    const res = execSync(`curl -s --max-time 2 ${OLLAMA_HOST}/api/tags`, { stdio: 'pipe' })
    JSON.parse(res.toString())
    return true
  } catch {
    return false
  }
}

export async function ensureOllama(): Promise<void> {
  if (isOllamaRunning()) return

  console.error('🦙 Ollama is not running — starting...')

  const child = spawn('ollama', ['serve'], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    if (isOllamaRunning()) {
      console.error('✅ Ollama ready')
      return
    }
  }

  throw new Error('Ollama did not respond after 15s. Make sure it is installed and running.')
}

export async function embedTexts(texts: string[], maxChars: number): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = []
  for (const text of texts) {
    try {
      const res = await ollama.embeddings({
        model: 'nomic-embed-text',
        prompt: text.slice(0, maxChars),
      })
      results.push(res.embedding)
    } catch {
      results.push(null)
    }
  }
  return results
}
