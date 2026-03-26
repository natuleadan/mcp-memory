import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getMemoriesTable } from './utils.js'

export function registerListMemoriesTool(server: McpServer) {
  server.tool(
    'list_memories',
    'Lists all saved memories, optionally filtered by type.',
    {
      type: z
        .enum(['soul', 'user', 'feedback', 'project', 'reference', 'pending', 'all'])
        .default('all')
        .describe('Filter by type or "all"'),
    },
    async ({ type }) => {
      try {
        const table = await getMemoriesTable()
        const filter = type !== 'all' ? `id != '__init__' AND type = '${type}'` : `id != '__init__'`
        const rows = (await table.query().where(filter).toArray()) as Array<{
          id: string
          type: string
          name: string
          body: string
          tags: string
          updated_at: string
        }>
        if (!rows.length) return { content: [{ type: 'text', text: 'No memories found.' }] }
        const formatted = rows.map(
          (r) =>
            `**[${r.id}]** \`${r.type}\` — **${r.name}** (${r.updated_at.slice(0, 10)})\n${r.body}${r.tags ? `\n_tags: ${r.tags}_` : ''}`
        )
        return { content: [{ type: 'text', text: formatted.join('\n\n---\n\n') }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error listing memories: ${String(e)}` }] }
      }
    }
  )
}
