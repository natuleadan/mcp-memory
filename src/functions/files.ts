import fs from 'node:fs'
import path from 'node:path'
import type { MemoryType } from '../types/index.js'
import { MEMORIES_DIR, MEMORIES_WRITE_ENABLED } from '../types/index.js'
import { getMemoriesTable } from './memories/crud.js'
import type { MemoryRow } from '../types/index.js'

function isEnabled(): boolean {
  return MEMORIES_WRITE_ENABLED && !!MEMORIES_DIR
}

function mdPath(type: string, name: string): string {
  return path.join(MEMORIES_DIR, type, `${name}.md`)
}

function buildFrontmatter(fields: Record<string, string | number>): string {
  const lines = Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
  return `---\n${lines}\n---\n\n`
}

export function writeMemoryMd(params: {
  id: string
  type: string
  name: string
  body: string
  tags: string
  weight?: number
  created_at: string
  updated_at: string
}): void {
  if (!isEnabled()) return
  const { id, type, name, body, tags, weight, created_at, updated_at } = params
  const dir = path.join(MEMORIES_DIR, type)
  fs.mkdirSync(dir, { recursive: true })
  const frontmatterData: Record<string, string | number> = { id, type, name, tags, created_at, updated_at }
  if (weight !== undefined) frontmatterData.weight = weight
  const frontmatter = buildFrontmatter(frontmatterData)
  fs.writeFileSync(mdPath(type, name), frontmatter + body, 'utf8')
}

export function deleteMemoryMd(type: string, name: string): void {
  if (!isEnabled()) return
  const file = mdPath(type, name)
  if (fs.existsSync(file)) fs.unlinkSync(file)
}

export function listMemoryFiles(type?: MemoryType) {
  if (!MEMORIES_DIR || !fs.existsSync(MEMORIES_DIR)) return []
  const types = type ? [type] : ['soul', 'user', 'feedback', 'project', 'reference', 'pending']
  const results: { type: string; name: string; path: string }[] = []
  for (const t of types) {
    const dir = path.join(MEMORIES_DIR, t)
    if (!fs.existsSync(dir)) continue
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) continue
      results.push({ type: t, name: file.replace(/\.md$/, ''), path: path.join(dir, file) })
    }
  }
  return results
}

export function readMemoryFile(type: string, name: string) {
  const file = path.join(MEMORIES_DIR, type, `${name}.md`)
  if (!fs.existsSync(file)) return null
  const raw = fs.readFileSync(file, 'utf8')
  const match = raw.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: raw }
  const frontmatter: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const [k, ...rest] = line.split(': ')
    if (k) frontmatter[k.trim()] = rest.join(': ').trim()
  }
  return { frontmatter, body: match[2] }
}

export async function syncMemoryFiles(
  type?: string,
  _dryRun: boolean = false,
  importMissing: boolean = false
) {
  const table = await getMemoriesTable()
  const dbRows = (await table.query().toArray()) as MemoryRow[]
  const files = listMemoryFiles(type as 'soul' | 'user' | 'feedback' | 'project' | 'reference' | 'pending' | undefined)
  const results: string[] = []

  const dbMap = new Map(dbRows.filter(r => r.id !== '__init__').map(r => [r.name, r]))

  for (const file of files) {
    if (!dbMap.has(file.name)) {
      if (importMissing) {
        results.push(`+ Import ${file.name}`)
      } else {
        results.push(`? Missing in DB: ${file.name}`)
      }
    }
  }

  return results.join('\n') || 'No differences'
}

export async function exportToMemories(type?: string, overwrite: boolean = true) {
  if (!MEMORIES_WRITE_ENABLED || !MEMORIES_DIR) {
    return { error: 'MEMORIES_WRITE_ENABLED not set' }
  }

  const table = await getMemoriesTable()
  const rows = (await table.query().toArray()) as MemoryRow[]
  const real = rows.filter(r => r.id !== '__init__')
  
  let exported = 0
  for (const r of real) {
    if (type && type !== 'all' && r.type !== type) continue
    
    const dir = path.join(MEMORIES_DIR, r.type)
    fs.mkdirSync(dir, { recursive: true })
    
    const file = path.join(dir, `${r.name}.md`)
    if (fs.existsSync(file) && !overwrite) continue

    const frontmatter = [
      '---',
      `id: ${r.id}`,
      `type: ${r.type}`,
      `name: ${r.name}`,
      `tags: ${r.tags}`,
      `weight: ${r.weight}`,
      `created_at: ${r.created_at}`,
      `updated_at: ${r.updated_at}`,
      '---',
      '',
    ].join('\n')

    fs.writeFileSync(file, frontmatter + r.body, 'utf8')
    exported++
  }

  return { exported, total: real.length }
}