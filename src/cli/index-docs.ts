import 'dotenv/config'
import * as lancedb from '@lancedb/lancedb'
import { ensureOllama } from '../functions/indexing/embedding.js'
import { start, done, indexTable } from '../functions/indexing/indexer.js'

const DOC_EXTS = new Set(['.md', '.sql', '.json', '.env.example', '.yml', '.yaml'])

async function main() {
  await ensureOllama()
  const SOURCE_DIR = process.env.CODING_DIR!
  const LANCEDB_DIR = process.env.LANCEDB_DIR!

  const db = await lancedb.connect(LANCEDB_DIR)
  start()
  await indexTable(db, 'docs', SOURCE_DIR, DOC_EXTS, false)
  done()
}

main().catch(console.error)
