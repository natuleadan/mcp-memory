import 'dotenv/config'
import * as lancedb from '@lancedb/lancedb'
import { readdirSync, statSync } from 'fs'
import { readFile } from 'fs/promises'
import { join, relative } from 'path'
import { ensureOllama, embedTexts } from '../functions/indexing/embedding.js'
import { chunkParagraphs } from '../functions/indexing/chunking.js'
import { IGNORE_PREFIXES, BATCH_SIZE } from '../types/index.js'

const LANCEDB_DIR = process.env.LANCEDB_DIR!
const CHATLOG_DIR = process.env.CHATLOG_DIR!
const MAX_CHARS = 1800
const TABLE_NAME = 'chatlogs'
const ALLOWED_EXTS = new Set(['.md', '.txt', '.json'])

const BAR_WIDTH = 16

function n(x: number): string {
  return x.toLocaleString('en-US')
}

function bar(current: number, total: number): string {
  const pct = total > 0 ? Math.min(current / total, 1) : 0
  const filled = Math.round(pct * BAR_WIDTH)
  return '\u2588'.repeat(filled) + '\u2591'.repeat(BAR_WIDTH - filled)
}

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
      if (IGNORE_PREFIXES.some(p => entry.startsWith(p))) continue
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

  console.log(`\n  \u2500\u2500 chatlogs ${'\u2500'.repeat(45)}`)
  const db = await lancedb.connect(LANCEDB_DIR)

  let existingChunks = new Map<string, number>()
  let table: Awaited<ReturnType<typeof db.openTable>> | null = null
  try {
    table = await db.openTable(TABLE_NAME)
    const existing = await table.query().select(['id', 'mtime']).toArray()
    existingChunks = new Map(existing.map((r: { id: string; mtime: number }) => [r.id, r.mtime]))
    console.log(`  \u25cf ${n(existingChunks.size)} chunks in DB`)
  } catch {
    console.log(`  \u25cf New table`)
  }

  const files = collectFiles(CHATLOG_DIR)
  console.log(`  \u25cf ${n(files.length)} files to scan`)

  const fileMap = new Map(files.map((f) => [relative(CHATLOG_DIR, f.path), f.mtime]))
  const staleIds: string[] = []
  for (const [id, mtime] of existingChunks) {
    const relPath = id.split('#')[0]
    const fileMtime = fileMap.get(relPath)
    if (fileMtime === undefined || fileMtime > mtime) staleIds.push(id)
  }
  if (staleIds.length > 0 && table) {
    await table.delete(`id IN (${staleIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(', ')})`)
    for (const id of staleIds) existingChunks.delete(id)
    console.log(`  \u25cf ${n(staleIds.length)} stale purged`)
  }

  const isNewTable = existingChunks.size === 0
  const allChunks: Omit<Chunk, 'vector'>[] = []
  let skippedCount = 0
  for (let fi = 0; fi < files.length; fi += BATCH_SIZE) {
    const batch = files.slice(fi, fi + BATCH_SIZE)
    const current = Math.min(fi + BATCH_SIZE, files.length)
    process.stdout.write(`\r\x1b[K  \u25cf Reading files... ${bar(current, files.length)} ${n(current)}/${n(files.length)}`)

    const contents = await Promise.all(batch.map(async ({ path: file, mtime: mt }) => {
      try {
        const content = await readFile(file, 'utf-8')
        if (content.length < 1024) return null
        return { file, mtime: mt, content: content.length > 1_048_576 ? content.slice(0, 1_048_576) : content }
      } catch {
        return null
      }
    }))

    for (const r of contents) {
      if (!r) { skippedCount++; continue }
      const { file, mtime, content } = r
      const relPath = relative(CHATLOG_DIR, file)
      const sections = chunkParagraphs(content)

      if (isNewTable) {
        for (let i = 0; i < sections.length; i++) {
          allChunks.push({ id: `${relPath}#${i}`, source: file, rel_path: relPath, text: sections[i], mtime })
        }
      } else {
        for (let i = 0; i < sections.length; i++) {
          const id = `${relPath}#${i}`
          if (!existingChunks.has(id)) {
            allChunks.push({ id, source: file, rel_path: relPath, text: sections[i], mtime })
          }
        }
      }
    }
  }
  if (files.length > 0) {
    process.stdout.write(`\r\x1b[K  \u25cf Reading files... ${bar(files.length, files.length)} ${n(files.length)}/${n(files.length)}\n`)
  }
  if (skippedCount > 0) {
    console.log(`  \u25cf ${n(skippedCount)} files skipped (empty/binary)`)
  }

  if (allChunks.length === 0) {
    console.log(`  \u2714 Up to date\n`)
    return
  }

  console.log(`  \u25cf ${n(allChunks.length)} new chunks to embed`)
  let totalWritten = 0
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE)
    const vectors = await embedTexts(batch.map((c) => c.text), MAX_CHARS)
    const batchChunks: Chunk[] = []
    for (let j = 0; j < batch.length; j++) {
      if (vectors[j] !== null) batchChunks.push({ ...batch[j], vector: vectors[j]! })
    }
    if (batchChunks.length > 0) {
      if (!table) {
        table = await db.createTable(TABLE_NAME, batchChunks)
      } else {
        await table.add(batchChunks)
      }
      totalWritten += batchChunks.length
    }
    const current = Math.min(i + BATCH_SIZE, allChunks.length)
    process.stdout.write(`\r\x1b[K  \u25cf Embedding... ${bar(current, allChunks.length)} ${n(current)}/${n(allChunks.length)}`)
  }
  console.log()
  console.log(`  \u25cf ${n(totalWritten)} chunks written to DB`)
  console.log(`  ${'\u2500'.repeat(52)}`)
  console.log(`  \u2714 Done\n`)
}

main().catch(console.error)
