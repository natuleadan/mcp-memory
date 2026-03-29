import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'

export const OBSIDIAN_VAULT_DIR = process.env.OBSIDIAN_VAULT_DIR ?? ''
export const OBSIDIAN_WRITE_ENABLED = process.env.OBSIDIAN_WRITE_ENABLED !== 'false'

function isEnabled(): boolean {
  return OBSIDIAN_WRITE_ENABLED && !!OBSIDIAN_VAULT_DIR
}

function mdPath(type: string, name: string): string {
  return path.join(OBSIDIAN_VAULT_DIR, type, `${name}.md`)
}

function buildFrontmatter(fields: Record<string, string>): string {
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
  created_at: string
  updated_at: string
}): void {
  if (!isEnabled()) return
  const { id, type, name, body, tags, created_at, updated_at } = params
  const dir = path.join(OBSIDIAN_VAULT_DIR, type)
  fs.mkdirSync(dir, { recursive: true })
  const frontmatter = buildFrontmatter({ id, type, name, tags, created_at, updated_at })
  fs.writeFileSync(mdPath(type, name), frontmatter + body, 'utf8')
}

export function deleteMemoryMd(type: string, name: string): void {
  if (!isEnabled()) return
  const file = mdPath(type, name)
  if (fs.existsSync(file)) fs.unlinkSync(file)
}

export function readMemoryMd(
  type: string,
  name: string
): { frontmatter: Record<string, string>; body: string } | null {
  const file = mdPath(type, name)
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

export function listMemoryMds(type?: string): Array<{ type: string; name: string; path: string }> {
  if (!OBSIDIAN_VAULT_DIR || !fs.existsSync(OBSIDIAN_VAULT_DIR)) return []
  const types = type
    ? [type]
    : ['soul', 'user', 'feedback', 'project', 'reference', 'pending']
  const results: Array<{ type: string; name: string; path: string }> = []
  for (const t of types) {
    const dir = path.join(OBSIDIAN_VAULT_DIR, t)
    if (!fs.existsSync(dir)) continue
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) continue
      results.push({ type: t, name: file.replace(/\.md$/, ''), path: path.join(dir, file) })
    }
  }
  return results
}
