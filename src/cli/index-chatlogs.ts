import 'dotenv/config'
import * as lancedb from '@lancedb/lancedb'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { ensureOllama, embedTexts } from '../functions/indexing/embedding.js'
import { chunkParagraphs } from '../functions/indexing/chunking.js'

const LANCEDB_DIR = process.env.LANCEDB_DIR!
const CHATLOG_DIR = process.env.CHATLOG_DIR!
const BATCH_SIZE = 10
const MAX_CHARS = 1800
const TABLE_NAME = 'chatlogs'
const ALLOWED_EXTS = new Set(['.md', '.txt', '.json'])

type Chunk = {
  id: string
  source: string
  rel_path: string
  text: string
  mtime: number
  vector: number[]
}

function collectFiles(dir: string): { path: string; mtime: number }[] {
  const files: { path: string; mtime: number }[] = []
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        files.push(...collectFiles(full))
      } else {
        const ext = '.' + entry.split('.').pop()!
        if (ALLOWED_EXTS.has(ext)) files.push({ path: full, mtime: Math.floor(stat.mtimeMs) })
      }
    }
  } catch {
    // dir does not exist or no permissions — skip
  }
  return files
}

async function main() {
  await ensureOllama()

  console.log(`\n  📂 Indexing chatlogs: ${CHATLOG_DIR}`)
  const db = await lancedb.connect(LANCEDB_DIR)

  let existingChunks = new Map<string, number>()
  let table: Awaited<ReturnType<typeof db.openTable>> | null = null
  try {
    table = await db.openTable(TABLE_NAME)
    const existing = await table.query().select(['id', 'mtime']).toArray()
    existingChunks = new Map(existing.map((r: { id: string; mtime: number }) => [r.id, r.mtime]))
    console.log(`    ✅ ${existingChunks.size} chunks already indexed`)
  } catch {
    console.log('    🆕 New table, indexing from scratch...')
  }

  const files = collectFiles(CHATLOG_DIR)
  console.log(`    📄 ${files.length} files found`)

  const staleIds: string[] = []
  for (const [id, mtime] of existingChunks) {
    const relPath = id.split('#')[0]
    const fileInfo = files.find((f) => relative(CHATLOG_DIR, f.path) === relPath)
    if (!fileInfo || fileInfo.mtime > mtime) staleIds.push(id)
  }
  if (staleIds.length > 0 && table) {
    console.log(`    🗑️  Removing ${staleIds.length} stale chunks...`)
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

    const relPath = relative(CHATLOG_DIR, file)
    const sections = chunkParagraphs(content)

    for (let i = 0; i < sections.length; i++) {
      const id = `${relPath}#${i}`
      if (!existingChunks.has(id)) {
        allChunks.push({ id, source: file, rel_path: relPath, text: sections[i], mtime })
      }
    }
  }

  if (allChunks.length === 0) {
    console.log('    ✨ All up to date')
    return
  }

  console.log(`    🔢 ${allChunks.length} new chunks to embed...`)
  const chunks: Chunk[] = []
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE)
    const vectors = await embedTexts(batch.map((c) => c.text), MAX_CHARS)
    for (let j = 0; j < batch.length; j++) {
      if (vectors[j] !== null) chunks.push({ ...batch[j], vector: vectors[j]! })
    }
    const done = Math.min(i + BATCH_SIZE, allChunks.length)
    process.stdout.write(
      `\r  ${done}/${allChunks.length} chunks (${Math.round((done / allChunks.length) * 100)}%)`
    )
  }
  console.log()

  if (table) {
    await table.add(chunks)
  } else {
    await db.createTable(TABLE_NAME, chunks)
  }
  console.log(`    ✅ ${chunks.length} chunks indexed\n`)
}

main().catch(console.error)
