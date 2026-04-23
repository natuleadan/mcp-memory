import 'dotenv/config'
import * as lancedb from '@lancedb/lancedb'
import { ensureOllama } from '../functions/indexing/embedding.js'
import { start, done, indexTable } from '../functions/indexing/indexer.js'

const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts', '.sh'])

async function main() {
  await ensureOllama()
  const SOURCE_DIR = process.env.CODING_DIR!
  const LANCEDB_DIR = process.env.LANCEDB_DIR!

  const db = await lancedb.connect(LANCEDB_DIR)
  start()
  await indexTable(db, 'codebase', SOURCE_DIR, CODE_EXTS, true)
  done()
}

main().catch(console.error)
