import { execSync, spawn } from 'child_process'

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? 'http://localhost:11434'

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

  console.error('🦙 Ollama no está corriendo — arrancando...')

  const child = spawn('ollama', ['serve'], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()

  // Esperar hasta 15s a que responda
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 1000))
    if (isOllamaRunning()) {
      console.error('✅ Ollama listo')
      return
    }
  }

  throw new Error('Ollama no respondió después de 15s. Verifica que esté instalado.')
}
