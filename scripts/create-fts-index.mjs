#!/usr/bin/env node
import * as lancedb from '@lancedb/lancedb'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const LANCEDB_DIR = process.env.LANCEDB_DIR

async function main() {
  try {
    console.log('🔄 Creating FTS index on body column...\n')
    const db = await lancedb.connect(LANCEDB_DIR)
    const table = await db.openTable('memories')

    await table.createIndex('body', { config: lancedb.Index.fts() })

    console.log('✅ FTS index created successfully on body column\n')
  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

main()
