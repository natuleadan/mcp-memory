import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getMemoriesTable } from './utils.js'

export function registerPurgeOldMemoriesTool(server: McpServer) {
  server.tool(
    'purge_old_memories',
    'Deletes memories older than a given number of days, optionally filtered by type. Use to clean up stale project memories. Soul, user, and feedback types are excluded by default for safety.',
    {
      days_ago: z.coerce
        .number()
        .describe('Delete memories whose updated_at is older than this many days'),
      type: z
        .enum(['project', 'reference', 'pending'])
        .describe(
          'Memory type to purge (only project/reference/pending allowed — soul/user/feedback protected)'
        ),
      dry_run: z.coerce
        .boolean()
        .default(true)
        .describe(
          'If true, returns what would be deleted without actually deleting (default: true)'
        ),
    },
    async ({ days_ago, type, dry_run }) => {
      try {
        const table = await getMemoriesTable()
        const cutoff = new Date(Date.now() - days_ago * 86400000).toISOString()
        const rows = (await table
          .query()
          .where(`id != '__init__' AND type = '${type}' AND updated_at < '${cutoff}'`)
          .toArray()) as Array<{ id: string; name: string; updated_at: string }>

        if (!rows.length) {
          return {
            content: [
              { type: 'text', text: `No ${type} memories older than ${days_ago} days found.` },
            ],
          }
        }

        const summary = rows
          .map((r) => `- [${r.id}] ${r.name} (updated: ${r.updated_at.slice(0, 10)})`)
          .join('\n')

        if (dry_run) {
          return {
            content: [
              {
                type: 'text',
                text: `DRY RUN — Would delete ${rows.length} ${type} memories:\n\n${summary}\n\nRun again with dry_run: false to confirm.`,
              },
            ],
          }
        }

        for (const r of rows) {
          await table.delete(`id = '${r.id}'`)
        }

        return {
          content: [
            {
              type: 'text',
              text: `Purged ${rows.length} ${type} memories older than ${days_ago} days:\n\n${summary}`,
            },
          ],
        }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error purging memories: ${String(e)}` }] }
      }
    }
  )
}
