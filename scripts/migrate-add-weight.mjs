#!/usr/bin/env node
import * as lancedb from '@lancedb/lancedb'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

const LANCEDB_DIR = process.env.LANCEDB_DIR ?? '~/.claude/lancedb'
const BACKUP_FILE = '/tmp/memories_backup.json'

async function migrate() {
  try {
    console.log('🔄 Migrating memories table to add weight field...\n')
    const db = await lancedb.connect(LANCEDB_DIR)
    const tables = await db.tableNames()

    if (!tables.includes('memories')) {
      console.log('✅ Memories table does not exist yet (will be created)')
      process.exit(0)
    }

    const table = await db.openTable('memories')
    const rows = await table.query().limit(10000).toArray()

    console.log(`Found ${rows.length} memories`)

    if (rows.every(r => r.weight)) {
      console.log('✅ All memories already have weight field')
      process.exit(0)
    }

    // Backup to JSON
    console.log('📦 Backing up memories to JSON...')
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(rows, null, 2))

    // Drop and recreate table
    console.log('🗑️  Dropping old memories table...')
    await db.dropTable('memories')

    // Create new table with weight in schema
    console.log('🆕 Creating new memories table with weight field...')
    const newTable = await db.createTable('memories', [
      {
        id: '__init__',
        type: 'system',
        name: 'init',
        body: 'init',
        tags: '',
        weight: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        vector: new Array(768).fill(0),
      },
    ])

    // Reinsert all rows with weight
    console.log(`⚙️  Reinsert ${rows.length} memories with weight...`)
    for (const row of rows) {
      await newTable.add([{
        id: row.id,
        type: row.type,
        name: row.name,
        body: row.body,
        tags: row.tags,
        weight: row.weight || 5,
        version: row.version,
        created_at: row.created_at,
        updated_at: row.updated_at,
        vector: row.vector,
      }])
    }

    console.log(`\n✅ Migration complete: ${rows.length} memories migrated\n`)
    fs.unlinkSync(BACKUP_FILE)
  } catch (err) {
    console.error('❌ Migration error:', err.message)
    if (fs.existsSync(BACKUP_FILE)) {
      console.error('💾 Backup saved to', BACKUP_FILE)
    }
    process.exit(1)
  }
}

migrate()
