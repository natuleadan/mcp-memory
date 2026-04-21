import * as lancedb from '@lancedb/lancedb'
import { randomUUID } from 'crypto'
import type { MemoryType, MemoryTypeAll, MemoryRow } from '../../types/index.js'
import { LANCEDB_DIR, EMBED_DIM } from '../../types/index.js'
import { embed } from '../search/data.js'
import { writeMemoryMd } from '../files.js'

async function getVersionsTable() {
  const db = await lancedb.connect(LANCEDB_DIR)
  const tables = await db.tableNames()
  if (!tables.includes('memory_versions')) {
    return db.createTable('memory_versions', [
      {
        id: '__init__',
        memory_id: '__init__',
        name: 'init',
        type: 'system',
        body: 'init',
        tags: '',
        version: 0,
        changed_at: new Date().toISOString(),
        embeddings: new Array(EMBED_DIM).fill(0),
      },
    ])
  }
  return db.openTable('memory_versions')
}

export async function getMemoriesTable() {
  const db = await lancedb.connect(LANCEDB_DIR)
  const tables = await db.tableNames()
  
  if (tables.includes('memories')) {
    const table = await db.openTable('memories')
    const sample = await table.query().limit(5).toArray()
    const hasRealData = sample.some(r => r.id !== '__init__')
    if (hasRealData) return table
    await db.dropTable('memories')
  }
  
  const table = await db.createTable('memories', [
    {
      id: '__init__',
      type: 'system',
      name: 'init',
      body: 'init',
      tags: '',
      weight: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      embeddings: new Array(EMBED_DIM).fill(0),
    },
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await table.createIndex('body', { config: (lancedb.Index as any).fts() })
  return table
}

export async function createMemory(
  type: MemoryType,
  name: string,
  body: string,
  tags: string = '',
  weight: number = 5,
  _writeToFiles?: boolean
) {
  const table = await getMemoriesTable()
  const id = randomUUID()
  const now = new Date().toISOString()
  const embeddings = await embed(body)
  
  await table.add([{
    id,
    type,
    name,
    body,
    tags: tags.toLowerCase(),
    weight,
    created_at: now,
    updated_at: now,
    embeddings,
  }])
  
  return { id, type, name, body, tags, weight, created_at: now, updated_at: now }
}

export async function upsertMemory(
  type: MemoryType,
  name: string,
  body: string,
  tags: string = '',
  weight: number = 5,
  writeToFiles: boolean = true
) {
  const table = await getMemoriesTable()
  const now = new Date().toISOString()
  const embeddings = await embed(body)
  const normalizedTags = tags.toLowerCase().trim()

  const existing = (await table.query().where(`name = '${name}'`).toArray()) as MemoryRow[]

  if (existing.length) {
    const { id, created_at, body: oldBody } = existing[0]

    // Save version snapshot before overwriting
    try {
      const versionsTable = await getVersionsTable()
      const versionEmbeddings = await embed(`${name} ${oldBody}`)
      await versionsTable.add([
        {
          id: randomUUID(),
          memory_id: id,
          name,
          type,
          body: oldBody,
          tags: existing[0].tags,
          version: 1,
          changed_at: now,
          embeddings: versionEmbeddings,
        },
      ])
    } catch {
      // Version tracking failure is non-fatal
    }

    await table.update({
      where: `id = '${id}'`,
      values: {
        body,
        tags: normalizedTags,
        weight,
        updated_at: now,
        embeddings,
      },
    })

    if (writeToFiles) {
      writeMemoryMd({
        id,
        type,
        name,
        body,
        tags: normalizedTags,
        weight,
        created_at,
        updated_at: now,
      })
    }

    return { id, type, name, body, tags: normalizedTags, weight, created_at, updated_at: now, updated: true }
  }

  const id = randomUUID()
  await table.add([
    {
      id,
      type,
      name,
      body,
      tags: normalizedTags,
      weight,
      created_at: now,
      updated_at: now,
      embeddings,
    },
  ])

  if (writeToFiles) {
    writeMemoryMd({
      id,
      type,
      name,
      body,
      tags: normalizedTags,
      weight,
      created_at: now,
      updated_at: now,
    })
  }

  return { id, type, name, body, tags: normalizedTags, weight, created_at: now, updated_at: now, created: true }
}

export async function updateMemory(
  id: string,
  updates: { body?: string; tags?: string; weight?: number; name?: string }
) {
  const table = await getMemoriesTable()
  const rows = (await table.query().toArray()) as MemoryRow[]
  const existing = rows.find(r => r.id === id)
  if (!existing) throw new Error(`Memory ${id} not found`)

  const now = new Date().toISOString()

  const updateValues: Record<string, unknown> = {
    updated_at: now,
  }
  
  if (updates.body !== undefined) {
    const embeddings = await embed(updates.body)
    updateValues.body = updates.body
    updateValues.embeddings = embeddings
  }
  if (updates.tags !== undefined) updateValues.tags = updates.tags.toLowerCase()
  if (updates.weight !== undefined) updateValues.weight = updates.weight
  if (updates.name !== undefined) updateValues.name = updates.name

  await table.update({
    where: `id = '${id}'`,
    values: updateValues,
  })

  return { id, ...existing, ...updates, updated_at: now }
}

export async function deleteMemory(id: string) {
  const table = await getMemoriesTable()
  await table.delete(`id = '${id}'`)
  return { deleted: id }
}

export async function listMemories(type?: MemoryTypeAll, limit: number = 50) {
  const table = await getMemoriesTable()
  let query = table.query().limit(limit)
  if (type && type !== 'all') {
    query = query.where(`type = '${type}'`)
  }
  const rows = (await query.toArray()) as MemoryRow[]
  return rows.filter(r => r.id !== '__init__').map(r => ({
    id: r.id,
    type: r.type,
    name: r.name,
    tags: r.tags,
    weight: r.weight,
    updated_at: r.updated_at,
  }))
}

export async function countMemories(type?: MemoryTypeAll) {
  const table = await getMemoriesTable()
  let query = table.query()
  if (type && type !== 'all') {
    query = query.where(`type = '${type}'`)
  }
  const rows = (await query.toArray()) as MemoryRow[]
  const total = rows.length
  const real = rows.filter(r => r.id !== '__init__').length
  return { total, real, byType: type ?? 'all' }
}

export async function getMemoryByName(name: string) {
  const table = await getMemoriesTable()
  const rows = (await table.query().where(`name = '${name}'`).toArray()) as MemoryRow[]
  return rows.find(r => r.id !== '__init__') ?? null
}