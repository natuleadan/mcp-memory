import 'dotenv/config'
import * as lancedb from '@lancedb/lancedb'
import { readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { LANCEDB_DIR, MEMORIES_DIR, CHATLOGS_DIR, CODING_DIR } from './types/index.js'

interface TestResult {
  name: string
  status: 'PASS' | 'FAIL' | 'WARN'
  details: string
}

function warn(msg: string) {
  console.log(`  ⚠️  ${msg}`)
}

function fail(msg: string) {
  console.log(`  🔴 ${msg}`)
}

function section(msg: string) {
  console.log(`\n  ${msg}`)
}

async function runTests(): Promise<void> {
  const results: TestResult[] = []

  section('🧪 Memory Diagnostics')

  section('🔍 LanceDB Tables')
  try {
    const db = await lancedb.connect(LANCEDB_DIR)
    const tables = await db.tableNames()
    console.log(`  Connected: ${LANCEDB_DIR}`)
    console.log(`  Tables: ${tables.length}`)

    for (const tableName of ['memories', 'codebase', 'docs', 'chatlogs', 'memory_versions']) {
      if (tables.includes(tableName)) {
        const table = await db.openTable(tableName)
        const rows = await table.query().toArray()
        const count = rows.filter((r: Record<string, unknown>) => r.id !== '__init__').length
        console.log(`  ${tableName}: ${count} rows`)
      } else {
        warn(`${tableName}: not created`)
      }
    }
    results.push({ name: 'LanceDB', status: 'PASS', details: tables.join(', ') })
  } catch (e) {
    fail(`Connection failed: ${String(e).slice(0, 80)}`)
    results.push({ name: 'LanceDB', status: 'FAIL', details: String(e).slice(0, 100) })
  }

  section('📂 Directories')
  const dirs = [
    { name: 'LanceDB', path: LANCEDB_DIR },
    { name: 'Memories', path: MEMORIES_DIR },
    { name: 'Chatlogs', path: CHATLOGS_DIR },
    { name: 'Coding', path: CODING_DIR },
  ]

  for (const dir of dirs) {
    const exists = existsSync(dir.path)
    if (exists) {
      console.log(`  ${dir.name}: ${dir.path}`)
      try {
        const files = readdirSync(dir.path, { withFileTypes: true })
        const fileCount = files.filter(f => f.isFile()).length
        const dirCount = files.filter(f => f.isDirectory()).length
        console.log(`    ${fileCount} files, ${dirCount} dirs`)
      } catch {
        warn(`Cannot read ${dir.name}`)
      }
    } else {
      fail(`${dir.name}: ${dir.path} (not found)`)
    }
  }

  section('📚 Memory Vault')
  if (existsSync(MEMORIES_DIR)) {
    const types = ['soul', 'user', 'feedback', 'project', 'reference', 'pending']
    for (const type of types) {
      const typePath = join(MEMORIES_DIR, type)
      if (existsSync(typePath)) {
        const files = readdirSync(typePath).filter(f => f.endsWith('.md'))
        if (files.length > 0) {
          console.log(`  ${type}: ${files.length} files`)
        } else {
          warn(`${type}: empty`)
        }
      } else {
        warn(`${type}: folder not exists`)
      }
    }
  } else {
    fail('Memories directory not accessible')
  }

  section('📊 Summary')
  const passed = results.filter(r => r.status === 'PASS').length
  const warnings = results.filter(r => r.status === 'WARN').length
  const failed = results.filter(r => r.status === 'FAIL').length

  console.log(`  Total: ${results.length} | PASS: ${passed} | WARN: ${warnings} | FAIL: ${failed}`)

  if (failed > 0) {
    console.log('\n  🔴 Some tests FAILED')
    process.exit(1)
  } else if (warnings > 0) {
    console.log('\n  ⚠️  Tests passed with WARNINGS')
  } else {
    console.log('\n  ✅ All tests PASSED')
  }
}

runTests().catch(console.error)