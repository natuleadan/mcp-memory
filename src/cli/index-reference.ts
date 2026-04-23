import 'dotenv/config'
import * as lancedb from '@lancedb/lancedb'
import { ensureOllama } from '../functions/indexing/embedding.js'
import { start, done, indexTable } from '../functions/indexing/indexer.js'

async function main() {
  await ensureOllama()
  const REFERENCE_DIR = process.env.REFERENCE_DIR!
  const LANCEDB_DIR = process.env.LANCEDB_DIR!

  const db = await lancedb.connect(LANCEDB_DIR)
  start()
  await indexTable(db, 'reference', REFERENCE_DIR, new Set(), false)
  done()
}

main().catch(console.error)
