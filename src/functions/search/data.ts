import * as lancedb from '@lancedb/lancedb'
import { Ollama } from 'ollama'
import { LANCEDB_DIR, OLLAMA_HOST, EMBED_DIM } from '../../types/index.js'

const ollama = new Ollama({ host: OLLAMA_HOST })

export async function embed(text: string): Promise<number[]> {
  const res = await ollama.embeddings({ model: 'nomic-embed-text', prompt: text })
  return res.embedding
}

async function createTableIfNeeded(db: Awaited<ReturnType<typeof lancedb.connect>>, source: string) {
  const tables = await db.tableNames()
  if (tables.includes(source)) {
    return db.openTable(source)
  }

  let schema: Record<string, unknown>
  
  if (source === 'memories') {
    schema = {
      id: '__init__',
      type: 'system',
      name: 'init',
      body: 'init',
      tags: '',
      weight: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      embeddings: new Array(EMBED_DIM).fill(0),
    }
  } else if (source === 'chatlogs') {
    schema = {
      id: '__init__',
      role: 'system',
      content: 'init',
      created_at: new Date().toISOString(),
      embeddings: new Array(EMBED_DIM).fill(0),
    }
  } else {
    schema = {
      id: '__init__',
      rel_path: 'init',
      text: 'init',
      language: 'text',
      created_at: new Date().toISOString(),
      embeddings: new Array(EMBED_DIM).fill(0),
    }
  }

  const table = await db.createTable(source, [schema])
  const ftsField = source === 'memories' ? 'body' : source === 'chatlogs' ? 'content' : 'text'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await table.createIndex(ftsField, { config: (lancedb.Index as any).fts() })
  return table
}

export async function getTable(source: 'memories' | 'codebase' | 'docs' | 'chatlogs') {
  const db = await lancedb.connect(LANCEDB_DIR)
  return createTableIfNeeded(db, source)
}

function formatMemories(rows: Record<string, unknown>[], mode: string): string[] {
  return rows.filter(r => r.id !== '__init__').map(r => {
    const body = r.body as string
    const isHighWeight = (r.weight as number ?? 5) >= 8
    let text: string

    if (mode === 'full') {
      text = body
    } else if (mode === 'lite') {
      text = body.slice(0, 200).replace(/\n/g, ' ')
    } else if (mode === 'condensed' || !isHighWeight) {
      text = body.slice(0, 200)
    } else {
      text = body
    }

    const ellipsis = mode === 'full' || mode === 'lite' || isHighWeight ? '' : body.length > 200 ? '…' : ''
    return `**[${r.id}]** \`${r.type}\` — **${r.name}** (w:${r.weight ?? 5}, ${(r.updated_at as string).slice(0, 10)})\n> ${text}${ellipsis}`
  })
}

function formatCodebaseDocs(rows: Record<string, unknown>[], mode: string): string[] {
  return rows.map(r => {
    const text = r.text as string
    if (mode === 'full') {
      return `### ${r.rel_path}\n\`\`\`${r.language}\n${text}\n\`\`\``
    }
    return `### ${r.rel_path}\n\`\`\`\n${text.slice(0, 300)}\n\`\`\``
  })
}

function formatChatlogs(rows: Record<string, unknown>[], _mode: string): string[] {
  return rows.map(r => {
    const text = r.text as string
    const path = r.rel_path as string
    const date = r.mtime ? new Date(r.mtime as number).toISOString().slice(0, 10) : 'unknown'
    return `[${date}] **${path}**: ${text.slice(0, 200)}`
  })
}

const formatters: Record<string, (rows: Record<string, unknown>[], mode: string) => string[]> = {
  memories: formatMemories,
  codebase: formatCodebaseDocs,
  docs: formatCodebaseDocs,
  chatlogs: formatChatlogs,
}

export async function searchData(
  source: 'memories' | 'codebase' | 'docs' | 'chatlogs',
  query: string,
  limit: number = 5,
  mode: 'critical' | 'condensed' | 'full' | 'lite' = 'critical',
  type?: string
) {
  const vector = await embed(query)
  const table = await getTable(source)

  let search = table.search(vector).limit(limit * 2)

  if (source === 'memories' && type && type !== 'all') {
    search = search.where(`type = '${type}'`)
  }

  const rows = (await search.toArray()) as Array<Record<string, unknown>>

  const formatter = formatters[source] ?? formatters.memories
  return formatter(rows.filter(r => r.id !== '__init__').slice(0, limit), mode)
}

export async function searchFts(
  source: 'memories' | 'codebase' | 'docs' | 'chatlogs',
  query: string,
  limit: number = 5,
  type?: string
) {
  const table = await getTable(source)
  let search = table.search(query).limit(limit)

  if (source === 'memories' && type && type !== 'all') {
    search = search.where(`type = '${type}'`)
  }

  const rows = (await search.toArray()) as Array<Record<string, unknown>>
  const formatter = formatters[source] ?? formatters.memories
  return formatter(rows.filter(r => r.id !== '__init__').slice(0, limit), 'condensed')
}

export async function searchAll(
  query: string,
  limit: number = 3,
  mode: 'compact' | 'full' = 'compact'
): Promise<string> {
  const vector = await embed(query)
  const sections: string[] = []

  const sources: Array<'memories' | 'codebase' | 'docs' | 'chatlogs'> = ['memories', 'codebase', 'docs', 'chatlogs']

  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        const table = await getTable(source)
        const rows = (await table.search(vector).limit(limit).toArray()) as Array<Record<string, unknown>>
        return { source, rows: rows.filter(r => r.id !== '__init__').slice(0, limit) }
      } catch {
        return { source, rows: [] }
      }
    })
  )

  for (const { source, rows } of results) {
    if (!rows.length) continue
    const formatter = formatters[source]
    const formatted = formatter(rows, mode)
    sections.push(`## ${source.toUpperCase()}\n\n${formatted.join('\n\n')}`)
  }

  return sections.join('\n\n===\n\n') || 'No results found.'
}