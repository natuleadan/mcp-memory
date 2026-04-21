import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export * from './memory.js'
export * from './search.js'
export * from './codebase.js'
export * from './docs.js'
export * from './chatlogs.js'

export const EMBED_DIM = 768
export const PROJECT_ROOT = path.resolve(__dirname, '../..')

export const LANCEDB_DIR = process.env.LANCEDB_DIR ?? path.join(PROJECT_ROOT, 'vectorial')
export const MEMORIES_DIR = process.env.MEMORIES_DIR ?? path.join(PROJECT_ROOT, 'memories')
export const CHATLOGS_DIR = process.env.CHATLOG_DIR ?? path.join(PROJECT_ROOT, 'chatlogs')
export const CODING_DIR = process.env.CODING_DIR ?? path.join(PROJECT_ROOT, 'coding')

export const MEMORIES_WRITE_ENABLED = process.env.MEMORIES_WRITE_ENABLED !== 'false'
export const OLLAMA_HOST = process.env.OLLAMA_HOST ?? 'http://localhost:11434'