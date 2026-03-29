import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getMemoriesTable } from './utils.js'
import { writeMemoryMd, OBSIDIAN_VAULT_DIR } from './obsidian-vault-client.js'
import type { MemoryRow } from './utils.js'

export function registerExportToObsidianTool(server: McpServer) {
  server.tool(
    'export_to_obsidian',
    'Export all memories from the vector DB to Obsidian markdown files. Use this to do an initial sync from DB to Obsidian vault.',
    {
      type: z
        .enum(['soul', 'user', 'feedback', 'project', 'reference', 'pending'])
        .optional()
        .describe('Export only this type (omit to export all)'),
      overwrite: z
        .boolean()
        .default(true)
        .describe('Overwrite existing MD files (default: true)'),
    },
    async ({ type }) => {
      try {
        if (!OBSIDIAN_VAULT_DIR) {
          return {
            content: [{ type: 'text', text: '❌ OBSIDIAN_VAULT_DIR not configured in .env' }],
            isError: true,
          }
        }

        const table = await getMemoriesTable()
        const query = type
          ? table.query().where(`type = '${type}'`)
          : table.query()

        const rows = (await query.toArray()) as MemoryRow[]
        const valid = rows.filter((r) => r.id !== '__init__')

        if (!valid.length) {
          return { content: [{ type: 'text', text: 'No memories found to export.' }] }
        }

        const results: string[] = []

        for (const row of valid) {
          try {
            writeMemoryMd({
              id: row.id,
              type: row.type,
              name: row.name,
              body: row.body,
              tags: row.tags ?? '',
              created_at: row.created_at,
              updated_at: row.updated_at,
            })
            results.push(`✅ ${row.type}/${row.name}`)
          } catch (err) {
            results.push(`❌ ${row.type}/${row.name}: ${String(err)}`)
          }
        }

        const succeeded = results.filter((r) => r.startsWith('✅')).length
        return {
          content: [
            {
              type: 'text',
              text: `Export complete: ${succeeded}/${valid.length} memories written to ${OBSIDIAN_VAULT_DIR}\n\n${results.join('\n')}`,
            },
          ],
        }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `❌ Error: ${String(e)}` }],
          isError: true,
        }
      }
    }
  )
}
