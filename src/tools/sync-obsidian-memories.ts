import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { listMemoryMds, readMemoryMd } from './obsidian-vault-client.js'
import { embed, getMemoriesTable } from './utils.js'

export function registerSyncObsidianMemoriesTool(server: McpServer) {
  server.tool(
    'sync_obsidian_memories',
    'Sync Obsidian markdown files back into the vector DB. Use this after editing memory files directly in Obsidian. Compares updated_at timestamps and re-embeds changed entries.',
    {
      type: z
        .enum(['soul', 'user', 'feedback', 'project', 'reference', 'pending'])
        .optional()
        .describe('Sync only this type (omit to sync all)'),
      dry_run: z
        .boolean()
        .default(false)
        .describe('Preview changes without writing to DB (default: false)'),
    },
    async ({ type, dry_run }) => {
      try {
        const files = listMemoryMds(type)
        if (!files.length) {
          return { content: [{ type: 'text', text: 'No markdown memories found in Obsidian vault.' }] }
        }

        const table = await getMemoriesTable()
        const results: string[] = []

        for (const file of files) {
          const md = readMemoryMd(file.type, file.name)
          if (!md) continue

          const { frontmatter, body } = md
          const mdUpdatedAt = frontmatter.updated_at ?? ''
          const mdId = frontmatter.id ?? ''

          if (!mdId) {
            results.push(`⚠️  ${file.type}/${file.name}: no id in frontmatter, skipping`)
            continue
          }

          // Check DB entry
          const rows = await table.query().where(`id = '${mdId}'`).toArray() as Array<{
            id: string; type: string; name: string; body: string; tags: string; updated_at: string; created_at: string
          }>

          if (!rows.length) {
            results.push(`⚠️  ${file.type}/${file.name}: id not found in DB, skipping`)
            continue
          }

          const dbRow = rows[0]
          const dbUpdatedAt = dbRow.updated_at ?? ''

          // Skip if DB is same or newer
          if (dbUpdatedAt >= mdUpdatedAt) {
            results.push(`✓  ${file.type}/${file.name}: up to date`)
            continue
          }

          // MD is newer — sync to DB
          if (!dry_run) {
            const newTags = frontmatter.tags ?? dbRow.tags
            const vector = await embed(`${file.name} ${body}`)
            await table.delete(`id = '${mdId}'`)
            await table.add([{
              id: mdId,
              type: file.type,
              name: file.name,
              body,
              tags: newTags,
              created_at: dbRow.created_at,
              updated_at: mdUpdatedAt,
              vector,
            }])
          }

          results.push(`${dry_run ? '[dry-run] ' : ''}✅ ${file.type}/${file.name}: synced from Obsidian (MD updated_at: ${mdUpdatedAt})`)
        }

        return {
          content: [
            {
              type: 'text',
              text: `Sync complete (${files.length} files checked):\n${results.join('\n')}`,
            },
          ],
        }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error syncing obsidian memories: ${String(e)}` }] }
      }
    }
  )
}
