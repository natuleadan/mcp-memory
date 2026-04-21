import type { MemoryRow, MemoryTypeAll } from '../../types/index.js'
import { getMemoriesTable } from './crud.js'

export async function loadMemoriesContext(mode: 'minimal' | 'compact' | 'full' = 'minimal') {
  const table = await getMemoriesTable()
  const rows = (await table.query().limit(50).toArray()) as MemoryRow[]
  const real = rows.filter(r => r.id !== '__init__')

  if (mode === 'minimal') {
    return real.slice(0, 20).map(r => `${r.type}:${r.name}`).join(', ')
  }

  if (mode === 'compact') {
    return real.slice(0, 15).map(r => {
      return `**${r.name}** (\`${r.type}\`, w:${r.weight}) ${r.body.slice(0, 120)}…`
    }).join('\n')
  }

  return real.map(r => {
    const isHighPriority = r.type === 'soul' || r.type === 'user'
    return `## ${r.name} [\`${r.type}\`]\n${isHighPriority ? r.body : r.body.slice(0, 300)}${r.body.length > 300 ? '\n…' : ''}`
  }).join('\n\n')
}

export async function getRecentMemories(days: number = 7, limit: number = 20) {
  const table = await getMemoriesTable()
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const rows = (await table.query().toArray()) as MemoryRow[]
  const recent = rows.filter(r => r.id !== '__init__' && r.updated_at >= cutoff)
  recent.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  return recent.slice(0, limit).map(r => ({
    name: r.name,
    type: r.type,
    updated_at: r.updated_at,
  }))
}

export async function getMemoriesByTag(tag: string, type?: string) {
  const table = await getMemoriesTable()
  let rows = (await table.query().toArray()) as MemoryRow[]
  rows = rows.filter(r => r.id !== '__init__' && r.tags.toLowerCase().includes(tag.toLowerCase()))
  if (type && type !== 'all') {
    rows = rows.filter(r => r.type === type)
  }
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    type: r.type,
    tags: r.tags,
  }))
}

export async function getContextForTask(task: string, limit: number = 5) {
  const { searchData } = await import('../search/data.js')
  const results = await searchData('memories', task, limit, 'critical')
  return results
}

export async function getMemoryStats() {
  const table = await getMemoriesTable()
  const rows = (await table.query().toArray()) as MemoryRow[]
  const real = rows.filter(r => r.id !== '__init__')
  
  const byType: Record<string, number> = {}
  for (const r of real) {
    byType[r.type] = (byType[r.type] || 0) + 1
  }

  const sorted = real.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  
  return {
    total: real.length,
    by_type: byType,
    oldest: sorted[0]?.updated_at ?? null,
    newest: sorted[sorted.length - 1]?.updated_at ?? null,
    avg_body_length: Math.round(real.reduce((sum, r) => sum + r.body.length, 0) / real.length),
  }
}

export async function memoryVersions(name: string) {
  const table = await getMemoriesTable()
  const rows = (await table.query().where(`name = '${name}'`).toArray()) as MemoryRow[]
  const versions = rows.filter(r => r.id !== '__init__')
  return versions.map(r => ({
    id: r.id,
    updated_at: r.updated_at,
  }))
}

export async function batchSearchMemories(queries: string[], limit: number = 3, type?: string) {
  const { searchData } = await import('../search/data.js')
  const results: Record<string, string> = {}
  
  for (const q of queries.split('\n').filter(Boolean).slice(0, 5)) {
    const searchResults = await searchData('memories', q.trim(), limit, 'critical', type as MemoryTypeAll)
    results[q.trim()] = searchResults.join('\n')
  }
  
  return results
}

export async function getMemoryVersions(name: string) {
  const { getTable } = await import('../search/data.js')
  try {
    const table = await getTable('memory_versions')
    const rows = (await table.query().where(`name = '${name}'`).toArray()) as Array<{
      id: string
      version: number
      name: string
      type: string
      body: string
      changed_at: string
    }>
    return rows.sort((a, b) => b.version - a.version)
  } catch (e) {
    const err = String(e)
    if (err.includes('not found') || err.includes('does not exist')) {
      return []
    }
    throw e
  }
}