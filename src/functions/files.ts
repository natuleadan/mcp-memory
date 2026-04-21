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

function getFileModifiedTime(filePath: string): number {
  const stat = fs.statSync(filePath)
  return stat.mtimeMs
}

function parseFrontmatter(frontmatter: Record<string, string>) {
  return {
    id: frontmatter.id || '',
    type: frontmatter.type || 'reference',
    name: frontmatter.name || '',
    tags: frontmatter.tags || '',
    weight: parseInt(frontmatter.weight || '5', 10),
    created_at: frontmatter.created_at || new Date().toISOString(),
    updated_at: frontmatter.updated_at || new Date().toISOString(),
  }
}

export interface SyncAction {
  type: 'import' | 'export' | 'update' | 'conflict'
  name: string
  source: 'md' | 'db' | 'both'
  details: string
}

export async function syncMemoryFiles(
  type?: string,
  dryRun: boolean = false,
  importMissing: boolean = false,
  exportMissing: boolean = false,
  autoResolve: 'newest' | 'db' | 'md' | 'warn' = 'warn'
): Promise<{ actions: SyncAction[]; conflicts: SyncAction[] }> {
  const table = await getMemoriesTable()
  const dbRows = (await table.query().toArray()) as MemoryRow[]
  const realDbRows = dbRows.filter(r => r.id !== '__init__')
  const files = listMemoryFiles(type as 'soul' | 'user' | 'feedback' | 'project' | 'reference' | 'pending' | undefined)

  const dbMap = new Map(realDbRows.map(r => [r.name, r]))
  const mdMap = new Map<string, { path: string; modified: number; frontmatter: Record<string, string>; body: string }>()

  for (const file of files) {
    const modified = getFileModifiedTime(file.path)
    const content = readMemoryFile(file.type, file.name)
    if (content) {
      mdMap.set(file.name, { path: file.path, modified, frontmatter: content.frontmatter, body: content.body })
    }
  }

  const actions: SyncAction[] = []
  const conflicts: SyncAction[] = []

  for (const [name, md] of mdMap) {
    const db = dbMap.get(name)

    if (!db) {
      if (importMissing || !exportMissing) {
        actions.push({ type: 'import', name, source: 'md', details: `Import ${name}.md → DB` })
      }
    } else {
      const dbTime = new Date(db.updated_at).getTime()
      const mdTime = md.modified

      if (dbTime !== mdTime) {
        if (mdTime > dbTime && db.body !== md.body) {
          if (autoResolve === 'warn') {
            conflicts.push({ type: 'conflict', name, source: 'both', details: `MD newer (${mdTime}) vs DB (${dbTime})` })
          } else if (autoResolve === 'newest' || autoResolve === 'md') {
            actions.push({ type: 'update', name, source: 'md', details: `Update DB from MD (MD more recent)` })
          }
        } else if (dbTime > mdTime && db.body !== md.body) {
          if (autoResolve === 'warn') {
            conflicts.push({ type: 'conflict', name, source: 'both', details: `DB newer (${dbTime}) vs MD (${mdTime})` })
          } else if (autoResolve === 'newest' || autoResolve === 'db') {
            actions.push({ type: 'update', name, source: 'db', details: `Update MD from DB (DB more recent)` })
          }
        } else if (mdTime > dbTime) {
          actions.push({ type: 'update', name, source: 'md', details: `Update DB from MD` })
        } else {
          actions.push({ type: 'update', name, source: 'db', details: `Update MD from DB` })
        }
      }
    }
  }

  for (const [name, db] of dbMap) {
    if (!mdMap.has(name)) {
      if (exportMissing || !importMissing) {
        actions.push({ type: 'export', name, source: 'db', details: `Export ${name} DB → ${db.type}/${name}.md` })
      }
    }
  }

  if (!dryRun) {
    for (const action of actions) {
      if (action.type === 'import') {
        const md = mdMap.get(action.name)!
        const fm = parseFrontmatter(md.frontmatter)
        await table.add([{ id: fm.id || crypto.randomUUID(), type: fm.type, name: fm.name, body: md.body, tags: fm.tags, weight: fm.weight, created_at: fm.created_at, updated_at: new Date().toISOString(), embeddings: [] }])
      } else if (action.type === 'export') {
        const db = dbMap.get(action.name)!
        writeMemoryMd({ id: db.id, type: db.type, name: db.name, body: db.body, tags: db.tags, weight: db.weight, created_at: db.created_at, updated_at: db.updated_at })
      } else if (action.type === 'update') {
        if (action.source === 'md') {
          const md = mdMap.get(action.name)!
          const fm = parseFrontmatter(md.frontmatter)
          await table.update({ where: `name = '${action.name}'`, values: { body: md.body, tags: fm.tags, weight: fm.weight, updated_at: new Date().toISOString() } })
        } else {
          const db = dbMap.get(action.name)!
          writeMemoryMd({ id: db.id, type: db.type, name: db.name, body: db.body, tags: db.tags, weight: db.weight, created_at: db.created_at, updated_at: new Date().toISOString() })
        }
      }
    }
  }

  return { actions, conflicts }
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
