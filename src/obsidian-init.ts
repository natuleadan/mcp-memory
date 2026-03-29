import { OBSIDIAN_VAULT_DIR, writeMemoryMd } from './tools/obsidian-vault-client.js'
import { getMemoriesTable } from './tools/utils.js'
import type { MemoryRow } from './tools/utils.js'
import fs from 'node:fs'
import path from 'node:path'

// Auto-export memories from DB to Obsidian vault on server startup.
// Only writes MDs that are missing — does not overwrite existing files.
export async function initObsidian(): Promise<void> {
  if (!OBSIDIAN_VAULT_DIR) {
    console.error('[obsidian] OBSIDIAN_VAULT_DIR not set — skipping auto-export')
    return
  }

  try {
    const table = await getMemoriesTable()
    const rows = (await table.query().toArray()) as MemoryRow[]
    const valid = rows.filter((r) => r.id !== '__init__')

    let exported = 0
    let skipped = 0

    for (const row of valid) {
      const mdFile = path.join(OBSIDIAN_VAULT_DIR, row.type, `${row.name}.md`)
      if (fs.existsSync(mdFile)) {
        skipped++
        continue
      }
      writeMemoryMd({
        id: row.id,
        type: row.type,
        name: row.name,
        body: row.body,
        tags: row.tags ?? '',
        created_at: row.created_at,
        updated_at: row.updated_at,
      })
      exported++
    }

    if (exported > 0 || skipped > 0) {
      console.error(
        `[obsidian] Auto-export complete: ${exported} written, ${skipped} already existed`
      )
    }
  } catch (err) {
    console.error(`[obsidian] Auto-export failed: ${String(err)}`)
  }
}
