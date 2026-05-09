import 'dotenv/config'
import * as lancedb from '@lancedb/lancedb'
import { createInterface } from 'readline'
import { ensureOllama } from '../functions/indexing/embedding.js'
import { start, done, indexTable, collectExtensionStats } from '../functions/indexing/indexer.js'

function n(x: number): string {
  return x.toLocaleString('en-US')
}

function ask(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(prompt, a => { rl.close(); resolve(a.trim()) }))
}

const REFERENCE_EXTS = new Set([
  '.ts', '.tsx', '.mts', '.cts',
  '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.pyw',
  '.rs',
  '.go',
  '.rb', '.erb',
  '.php', '.phtml',
  '.swift',
  '.kt', '.kts',
  '.c', '.cpp', '.cxx', '.cc', '.h', '.hpp', '.hxx',
  '.java',
  '.r', '.rmd',
  '.pl', '.pm',
  '.scala',
  '.sh', '.bash', '.zsh', '.fish',
  '.md', '.mdx', '.rst', '.adoc', '.txt', '.tex',
  '.sql',
  '.json', '.toml', '.yaml', '.yml',
  '.env.example', '.env',
  '.ini', '.cfg', '.conf',
  '.css', '.scss', '.sass', '.less',
  '.html', '.htm',
  '.graphql', '.gql',
  '.proto',
  '.xml',
  '.vue', '.svelte',
  '.gradle', '.properties',
  '.dockerfile',
  '.cmake',
  '.makefile',
])

const CODE_EXTS = new Set([
  '.ts', '.tsx', '.mts', '.cts',
  '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.pyw',
  '.rs',
  '.go',
  '.rb', '.erb',
  '.php', '.phtml',
  '.swift',
  '.kt', '.kts',
  '.c', '.cpp', '.cxx', '.cc', '.h', '.hpp', '.hxx',
  '.java',
  '.sh', '.bash', '.zsh', '.fish',
])

function mergeStats(dirs: string[]): Map<string, number> {
  const merged = new Map<string, number>()
  for (const dir of dirs) {
    const stats = collectExtensionStats(dir)
    for (const [ext, count] of stats) {
      merged.set(ext, (merged.get(ext) ?? 0) + count)
    }
  }
  return merged
}

async function main() {
  await ensureOllama()
  const raw = process.env.REFERENCE_DIR
  if (!raw) { console.log('  \u2714 REFERENCE_DIR not set, skipped\n'); return }
  const dirs = raw.split(',').map(s => s.trim()).filter(Boolean)
  if (dirs.length === 0) { console.log('  \u2714 REFERENCE_DIR not set, skipped\n'); return }

  const LANCEDB_DIR = process.env.LANCEDB_DIR!

  const allExts = mergeStats(dirs)
  const indexed = new Map<string, number>()
  const skipped = new Map<string, number>()
  for (const [ext, count] of allExts) {
    if (REFERENCE_EXTS.has(ext)) indexed.set(ext, count)
    else skipped.set(ext, count)
  }
  const totalIndexed = [...indexed.values()].reduce((a, b) => a + b, 0)
  const totalSkipped = [...skipped.values()].reduce((a, b) => a + b, 0)

  const sortedIndexed = [...indexed.entries()].sort((a, b) => b[1] - a[1])
  const sortedSkipped = [...skipped.entries()].sort((a, b) => b[1] - a[1])
  console.log(`\n  \u2500\u2500 Reference extensions ${'\u2500'.repeat(35)}`)
  console.log(`  \u25cf ${n(totalIndexed)} files in ${indexed.size} extensions`)
  if (sortedIndexed.length > 0) {
    const top = sortedIndexed.slice(0, 8)
    console.log(`     ${top.map(([e, c]) => `${e} ${n(c)}`).join(', ')}${sortedIndexed.length > 8 ? ', ...' : ''}`)
  }
  if (totalSkipped > 0) {
    const top = sortedSkipped.slice(0, 6)
    console.log(`  \u25cf ${n(totalSkipped)} skipped (${top.map(([e, c]) => `${e} ${n(c)}`).join(', ')}${sortedSkipped.length > 6 ? ', ...' : ''})`)
  }

  let activeExts = REFERENCE_EXTS
  if (totalIndexed > 5000 && process.stdin.isTTY) {
    console.log()
    console.log(`  \u2500\u2500 Large index ${'\u2500'.repeat(43)}`)
    console.log(`  ${n(totalIndexed)} files to process — est. ~${n(Math.round(totalIndexed * 4))} chunks`)
    console.log()
    console.log(`  \u2514 Options:`)
    console.log(`     a  \u2500 all ${indexed.size} extensions`)
    console.log(`     c  \u2500 code only (.ts, .js, .py, .rs, .go, ...)`)
    console.log(`     n  \u2500 skip reference indexing`)
    console.log(`     or type extensions: .ts,.js,.json`)
    console.log(`  ${'\u2500'.repeat(52)}`)
    const answer = await ask(`  \u2770 `)
    console.log()

    if (answer === 'n' || answer === 'N') {
      console.log(`  \u2714 Reference skipped\n`)
      return
    }
    if (answer === 'c' || answer === 'C') {
      activeExts = CODE_EXTS
    } else if (answer !== 'a' && answer !== 'A' && answer !== '') {
      const picked = answer.split(',').map(s => s.startsWith('.') ? s.trim() : '.' + s.trim()).filter(Boolean)
      if (picked.length > 0) {
        activeExts = new Set(picked.filter(e => REFERENCE_EXTS.has(e)))
        if (activeExts.size === 0) activeExts = REFERENCE_EXTS
      }
    }
  }

  const db = await lancedb.connect(LANCEDB_DIR)
  for (const dir of dirs) {
    start()
    await indexTable(db, 'reference', dir, activeExts, false)
    done()
  }
}

main().catch(console.error)
