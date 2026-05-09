import * as lancedb from '@lancedb/lancedb'
import { readdirSync, statSync } from 'fs'
import { readFile } from 'fs/promises'
import { join, relative } from 'path'
import { embedTexts } from './embedding.js'
import { chunkCode, chunkParagraphs } from './chunking.js'
import { IGNORE_PREFIXES, BATCH_SIZE } from '../../types/index.js'

export const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', '.turbo',
  'coverage', '.cache', 'out', '.pnpm-store',
])

const MAX_CHARS = 1800

function n(x: number): string {
  return x.toLocaleString('en-US')
}

function bar(current: number, total: number, width = 20): string {
  const pct = total > 0 ? Math.min(current / total, 1) : 0
  const filled = Math.round(pct * width)
  return '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled)
}

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
  console.log(`\n  \u2500\u2500 ${msg} ${'\u2500'.repeat(40)}`)
}

export function start() {
  console.log(`\n  \u26a1 Indexing\n`)
}

export function done() {
  console.log(`  ${'\u2500'.repeat(52)}`)
  console.log(`  \u2714 Done\n`)
}

export function collectExtensionStats(dir: string): Map<string, number> {
  const stats = new Map<string, number>()
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue
    if (IGNORE_PREFIXES.some(p => entry.startsWith(p))) continue
    const full = join(dir, entry)
    let stat
    try { stat = statSync(full) } catch { continue }
    if (stat.isDirectory()) {
      const sub = collectExtensionStats(full)
      for (const [ext, count] of sub) {
        stats.set(ext, (stats.get(ext) ?? 0) + count)
      }
    } else {
      const ext = '.' + entry.split('.').pop()!
      stats.set(ext, (stats.get(ext) ?? 0) + 1)
    }
  }
  return stats
}

export function collectFiles(
  dir: string,
  allowedExts: Set<string>
): { path: string; mtime: number }[] {
  const files: { path: string; mtime: number }[] = []
  if (!dir) return files
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue
    if (IGNORE_PREFIXES.some(p => entry.startsWith(p))) continue
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
    log(`\u25cf ${n(existingChunks.size)} chunks in DB`)
  } catch {
    log(`\u25cf New table`)
  }

  const files = collectFiles(sourceDir, allowedExts)
  log(`\u25cf ${n(files.length)} files to scan`)

  const fileMap = new Map(files.map((f) => [relative(sourceDir, f.path), f.mtime]))
  const staleIds: string[] = []
  for (const [id, mtime] of existingChunks) {
    const relPath = id.split('#')[0]
    const fileMtime = fileMap.get(relPath)
    if (fileMtime === undefined || fileMtime > mtime) staleIds.push(id)
  }
  if (staleIds.length > 0 && table) {
    await table.delete(`id IN (${staleIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(', ')})`)
    for (const id of staleIds) existingChunks.delete(id)
    log(`\u25cf ${n(staleIds.length)} stale purged`)
  }

  const isNewTable = existingChunks.size === 0
  const allChunks: Omit<Chunk, 'vector'>[] = []
  let skippedCount = 0
  for (let fi = 0; fi < files.length; fi += BATCH_SIZE) {
    const batch = files.slice(fi, fi + BATCH_SIZE)
    const current = Math.min(fi + BATCH_SIZE, files.length)
    process.stdout.write(`\r\x1b[K  \u25cf Reading files... ${bar(current, files.length, 16)} ${n(current)}/${n(files.length)}`)

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
      const relPath = relative(sourceDir, file)
      const ext = '.' + file.split('.').pop()!
      const sections = isCode ? chunkCode(content) : chunkParagraphs(content)

      if (isNewTable) {
        for (let i = 0; i < sections.length; i++) {
          allChunks.push({ id: `${relPath}#${i}`, source: file, rel_path: relPath, ext, text: sections[i], mtime })
        }
      } else {
        for (let i = 0; i < sections.length; i++) {
          const id = `${relPath}#${i}`
          if (!existingChunks.has(id)) {
            allChunks.push({ id, source: file, rel_path: relPath, ext, text: sections[i], mtime })
          }
        }
      }
    }
  }
  if (files.length > 0) {
    process.stdout.write(`\r\x1b[K  \u25cf Reading files... ${bar(files.length, files.length, 16)} ${n(files.length)}/${n(files.length)}\n`)
  }
  if (skippedCount > 0) {
    log(`\u25cf ${n(skippedCount)} files skipped (empty/binary)`)
  }

  if (allChunks.length === 0) {
    log(`\u2714 Up to date\n`)
    return
  }

  log(`\u25cf ${n(allChunks.length)} new chunks to embed`)
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
        table = await db.createTable(tableName, batchChunks)
      } else {
        await table.add(batchChunks)
      }
      totalWritten += batchChunks.length
    }
    const current = Math.min(i + BATCH_SIZE, allChunks.length)
    process.stdout.write(`\r\x1b[K  \u25cf Embedding... ${bar(current, allChunks.length, 16)} ${n(current)}/${n(allChunks.length)}`)
  }
  console.log()
  log(`\u25cf ${n(totalWritten)} chunks written to DB`)
}
