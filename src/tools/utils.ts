import 'dotenv/config'
import * as lancedb from '@lancedb/lancedb'
import { Ollama } from 'ollama'
import { randomUUID } from 'crypto'

const ollama = new Ollama({ host: process.env.OLLAMA_HOST ?? 'http://localhost:11434' })

export const LANCEDB_DIR = process.env.LANCEDB_DIR!
export const EMBED_DIM = 768
export { randomUUID }

export async function getTable(name: string) {
  const db = await lancedb.connect(LANCEDB_DIR)
  return db.openTable(name)
}

export async function embed(text: string): Promise<number[]> {
  const res = await ollama.embeddings({ model: 'nomic-embed-text', prompt: text })
  return res.embedding
}

export async function getMemoriesTable() {
  const db = await lancedb.connect(LANCEDB_DIR)
  const tables = await db.tableNames()
  if (!tables.includes('memories')) {
    return db.createTable('memories', [
      {
        id: '__init__',
        type: 'system',
        name: 'init',
        body: 'init',
        tags: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        vector: new Array(EMBED_DIM).fill(0) as number[],
      },
    ])
  }
  return db.openTable('memories')
}

export type MemoryRow = {
  id: string
  type: string
  name: string
  body: string
  tags: string
  updated_at: string
  created_at: string
}
