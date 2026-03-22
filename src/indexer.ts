import 'dotenv/config'
import * as lancedb from '@lancedb/lancedb'
import { Ollama } from 'ollama'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { ensureOllama } from './ollama-utils.js'

const ollama = new Ollama({ host: process.env.OLLAMA_HOST ?? 'http://localhost:11434' })
const LANCEDB_DIR = process.env.LANCEDB_DIR!
const BATCH_SIZE = 10
const MAX_CHARS = 1800 // nomic-embed-text soporta ~2048 tokens; 1800 chars es seguro

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', '.turbo',
  'coverage', '.cache', 'out', '.pnpm-store',
])

// Table `codebase`: logic and implementations
const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts', '.sh'])
// Table `docs`: documentation, schemas, configuration
const DOC_EXTS = new Set(['.md', '.sql', '.json', '.env.example', '.yml', '.yaml'])

type Chunk = {
  id: string
  source: string
  rel_path: string
  ext: string
  text: string
  mtime: number
  vector: number[]
}

function collectFiles(dir: string, allowedExts: Set<string>): { path: string; mtime: number }[] {
  const files: { path: string; mtime: number }[] = []
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      files.push(...collectFiles(full, allowedExts))
    } else {
      const ext = '.' + entry.split('.').pop()!
      if (allowedExts.has(ext)) files.push({ path: full, mtime: Math.floor(stat.mtimeMs) })
    }
  }
  return files
}

function chunkCode(content: string): string[] {
  const BLOCK_START = /^(export\s+)?(async\s+)?(function|class|const\s+\w+\s*=|type\s+\w+|interface\s+\w+|enum\s+\w+)/
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

function chunkParagraphs(content: string): string[] {
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

async function embed(texts: string[]): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = []
  for (const text of texts) {
    try {
      const res = await ollama.embeddings({ model: 'nomic-embed-text', prompt: text.slice(0, MAX_CHARS) })
      results.push(res.embedding)
    } catch {
      results.push(null)
    }
  }
  return results
}

async function indexTable(
  db: Awaited<ReturnType<typeof lancedb.connect>>,
  tableName: string,
  sourceDir: string,
  allowedExts: Set<string>,
  isCode: boolean,
) {
  console.log(`\n📂 Indexando tabla [${tableName}]: ${sourceDir}`)

  let existingChunks = new Map<string, number>()
  let table: Awaited<ReturnType<typeof db.openTable>> | null = null
  try {
    table = await db.openTable(tableName)
    const existing = await table.query().select(['id', 'mtime']).toArray()
    existingChunks = new Map(existing.map((r: { id: string; mtime: number }) => [r.id, r.mtime]))
    console.log(`  ✅ ${existingChunks.size} chunks ya indexados`)
  } catch {
    console.log('  🆕 Tabla nueva, indexando desde cero...')
  }

  const files = collectFiles(sourceDir, allowedExts)
  console.log(`  📄 ${files.length} archivos encontrados`)

  // Detectar archivos modificados
  const staleIds: string[] = []
  for (const [id, mtime] of existingChunks) {
    const relPath = id.split('#')[0]
    const fileInfo = files.find(f => relative(sourceDir, f.path) === relPath)
    if (!fileInfo || fileInfo.mtime > mtime) staleIds.push(id)
  }
  if (staleIds.length > 0 && table) {
    console.log(`  🗑️  Removing ${staleIds.length} stale chunks from modified files...`)
    const escaped = staleIds.map(id => `'${id.replace(/'/g, "''")}'`).join(', ')
    await table.delete(`id IN (${escaped})`)
    for (const id of staleIds) existingChunks.delete(id)
  }

  const allChunks: Omit<Chunk, 'vector'>[] = []
  for (const { path: file, mtime } of files) {
    let content: string
    try { content = readFileSync(file, 'utf-8') } catch { continue }
    if (content.length < 30) continue

    const relPath = relative(sourceDir, file)
    const ext = '.' + file.split('.').pop()!
    const sections = isCode ? chunkCode(content) : chunkParagraphs(content)

    for (let i = 0; i < sections.length; i++) {
      const id = `${relPath}#${i}`
      if (!existingChunks.has(id)) {
        allChunks.push({ id, source: file, rel_path: relPath, ext, text: sections[i], mtime })
      }
    }
  }

  if (allChunks.length === 0) {
    console.log('  ✨ Todo al día, nada nuevo que indexar.')
    return
  }

  console.log(`  🔢 ${allChunks.length} chunks nuevos a embedear...`)
  const chunks: Chunk[] = []
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE)
    const vectors = await embed(batch.map(c => c.text))
    for (let j = 0; j < batch.length; j++) {
      if (vectors[j] !== null) chunks.push({ ...batch[j], vector: vectors[j]! })
    }
    const done = Math.min(i + BATCH_SIZE, allChunks.length)
    process.stdout.write(`\r  ${done}/${allChunks.length} chunks (${Math.round(done / allChunks.length * 100)}%)`)
  }
  console.log()

  if (table) {
    await table.add(chunks)
  } else {
    await db.createTable(tableName, chunks)
  }
  console.log(`  ✅ ${chunks.length} chunks indexados en [${tableName}]`)
}

async function main() {
  await ensureOllama()
  const SOURCE_DIR = process.env.FULLSTACK_DIR!
  const MODE = process.argv[2] ?? 'all' // 'code' | 'docs' | 'all'

  const db = await lancedb.connect(LANCEDB_DIR)

  if (MODE === 'code' || MODE === 'all') {
    await indexTable(db, 'codebase', SOURCE_DIR, CODE_EXTS, true)
  }
  if (MODE === 'docs' || MODE === 'all') {
    await indexTable(db, 'docs', SOURCE_DIR, DOC_EXTS, false)
  }
}

main().catch(console.error)
