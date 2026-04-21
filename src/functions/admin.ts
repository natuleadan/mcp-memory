import * as lancedb from '@lancedb/lancedb'
import type { MemoryRow } from '../types/index.js'
import { LANCEDB_DIR } from '../types/index.js'
import { getMemoriesTable } from './memories/crud.js'

export async function reindexTable(target: 'code' | 'docs' | 'chatlogs' | 'all') {
  const db = await lancedb.connect(LANCEDB_DIR)
  const tables = target === 'all' ? ['codebase', 'docs', 'chatlogs'] : [target]
  const results: string[] = []

  for (const t of tables) {
    try {
      const exists = (await db.tableNames()).includes(t)
      if (exists) {
        results.push(`✅ ${t} already indexed`)
      } else {
        results.push(`⏳ ${t} not found`)
      }
    } catch (e) {
      results.push(`❌ ${t}: ${String(e).slice(0, 50)}`)
    }
  }

  return results.join('\n')
}

export async function purgeOldMemories(daysAgo: number, type?: 'project' | 'reference' | 'pending', dryRun: boolean = true) {
  const table = await getMemoriesTable()
  const cutoff = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
  const rows = (await table.query().toArray()) as MemoryRow[]
  
  let toDelete = rows.filter(r => r.id !== '__init__' && r.updated_at < cutoff)
  if (type) {
    toDelete = toDelete.filter(r => r.type === type)
  }

  if (dryRun) {
    return { wouldDelete: toDelete.length, items: toDelete.map(r => r.name) }
  }

  for (const r of toDelete) {
    await table.delete(`id = '${r.id}'`)
  }

  return { deleted: toDelete.length }
}

export async function assignWeightsByType(
  type: string,
  weight: number,
  dryRun: boolean = false,
  force: boolean = false
) {
  const table = await getMemoriesTable()
  const rows = (await table.query().toArray()) as MemoryRow[]
  const target = rows.filter(r => r.id !== '__init__' && r.type === type && (!r.weight || force))

  if (dryRun) {
    return { wouldUpdate: target.length }
  }

  for (const r of target) {
    await table.delete(`id = '${r.id}'`)
    await table.add([{ ...r, weight }])
  }

  return { updated: target.length }
}