import * as lancedb from '@lancedb/lancedb'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { embedTexts } from './embedding.js'
import { chunkCode, chunkParagraphs } from './chunking.js'

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', '.turbo',
  'coverage', '.cache', 'out', '.pnpm-store',
])
const BATCH_SIZE = 10
const MAX_CHARS = 1800

export type Chunk = {
  id: string
  source: string
  rel_path: string
  ext: string
  text: string
  mtime: number
  vector: number[]
}

export function log(msg: string) {
  console.log(`  ${msg}`)
}

export function section(msg: string) {
  console.log(`\n  📚 ${msg}`)
}

export function start() {
  console.log(`\n  ⚡ Indexing\n`)
}

export function done() {
  console.log(`\n  ✅ Done\n`)
}

export function collectFiles(
  dir: string,
  allowedExts: Set<string>
): { path: string; mtime: number }[] {
  const files: { path: string; mtime: number }[] = []
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      files.push(...collectFiles(full, allowedExts))
    } else {
      if (allowedExts.size === 0) {
        files.push({ path: full, mtime: Math.floor(stat.mtimeMs) })
      } else {
        const ext = '.' + entry.split('.').pop()!
        if (allowedExts.has(ext)) files.push({ path: full, mtime: Math.floor(stat.mtimeMs) })
      }
    }
  }
  return files
}

export async function indexTable(
  db: Awaited<ReturnType<typeof lancedb.connect>>,
  tableName: string,
  sourceDir: string,
  allowedExts: Set<string>,
  isCode: boolean
) {
  section(tableName)

  let existingChunks = new Map<string, number>()
  let table: Awaited<ReturnType<typeof db.openTable>> | null = null
  try {
    table = await db.openTable(tableName)
    const existing = await table.query().select(['id', 'mtime']).toArray()
    existingChunks = new Map(existing.map((r: { id: string; mtime: number }) => [r.id, r.mtime]))
    log(`${existingChunks.size} chunks indexed`)
  } catch {
    log(`Creating new table...`)
  }

  const files = collectFiles(sourceDir, allowedExts)
  log(`${files.length} files found`)

  const staleIds: string[] = []
  for (const [id, mtime] of existingChunks) {
    const relPath = id.split('#')[0]
    const fileInfo = files.find((f) => relative(sourceDir, f.path) === relPath)
    if (!fileInfo || fileInfo.mtime > mtime) staleIds.push(id)
  }
  if (staleIds.length > 0 && table) {
    log(`Removing ${staleIds.length} stale chunks...`)
    const escaped = staleIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(', ')
    await table.delete(`id IN (${escaped})`)
    for (const id of staleIds) existingChunks.delete(id)
  }

  const allChunks: Omit<Chunk, 'vector'>[] = []
  for (const { path: file, mtime } of files) {
    let content: string
    try {
      content = readFileSync(file, 'utf-8')
    } catch {
      continue
    }
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
    log(`All up to date`)
    return
  }

  log(`${allChunks.length} chunks to embed...`)
  const chunks: Chunk[] = []
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE)
    const vectors = await embedTexts(batch.map((c) => c.text), MAX_CHARS)
    for (let j = 0; j < batch.length; j++) {
      if (vectors[j] !== null) chunks.push({ ...batch[j], vector: vectors[j]! })
    }
    const done = Math.min(i + BATCH_SIZE, allChunks.length)
    process.stdout.write(`\r  ${done}/${allChunks.length} chunks (${Math.round((done / allChunks.length) * 100)}%)`)
  }
  console.log()

  if (table) {
    await table.add(chunks)
  } else {
    await db.createTable(tableName, chunks)
  }
  log(`${chunks.length} chunks indexed`)
}
