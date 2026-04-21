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
    console.log('🔄 Adding weight column to memories table...\n')
    const db = await lancedb.connect(LANCEDB_DIR)
    const table = await db.openTable('memories')

    // add_columns inserts a new column with a SQL expression
    // This is non-destructive — preserves all existing data
    await table.addColumns([{ name: 'weight', valueSql: 'CAST(5 AS INT)' }])

    console.log('✅ Column weight added with default value 5\n')
  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

main()
