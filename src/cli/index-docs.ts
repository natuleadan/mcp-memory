import 'dotenv/config'
import * as lancedb from '@lancedb/lancedb'
import { ensureOllama } from '../functions/indexing/embedding.js'
import { start, done, indexTable } from '../functions/indexing/indexer.js'

const DOC_EXTS = new Set(['.md', '.sql', '.json', '.env.example', '.yml', '.yaml'])

async function main() {
  await ensureOllama()
  const raw = process.env.CODING_DIR
  if (!raw) { console.log('  \u2714 CODING_DIR not set, skipped\n'); return }
  const dirs = raw.split(',').map(s => s.trim()).filter(Boolean)
  if (dirs.length === 0) { console.log('  \u2714 CODING_DIR not set, skipped\n'); return }

  const LANCEDB_DIR = process.env.LANCEDB_DIR!
  const db = await lancedb.connect(LANCEDB_DIR)

  for (const dir of dirs) {
    start()
    await indexTable(db, 'docs', dir, DOC_EXTS, false)
    done()
  }
}

main().catch(console.error)
