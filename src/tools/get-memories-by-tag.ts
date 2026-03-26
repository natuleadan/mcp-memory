import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getMemoriesTable } from './utils.js'

export function registerGetMemoriesByTagTool(server: McpServer) {
  server.tool(
    'get_memories_by_tag',
    'Filters memories by a specific tag. Fast lookup when you know the tag. Returns all matching memories.',
    {
      tag: z.string().describe('Tag to filter by (e.g. "CRITICAL", "commits", "git")'),
      type: z.enum(['soul', 'user', 'feedback', 'project', 'reference', 'pending', 'all']).default('all').describe('Optionally filter by memory type'),
    },
    async ({ tag, type }) => {
      try {
        const table = await getMemoriesTable()
        const typeFilter = type !== 'all' ? ` AND type = '${type}'` : ''
        const rows = (await table.query()
          .where(`id != '__init__' AND tags LIKE '%${tag}%'${typeFilter}`)
          .toArray()) as Array<{ id: string; type: string; name: string; body: string; tags: string; updated_at: string }>
        if (!rows.length) return { content: [{ type: 'text', text: `No memories found with tag "${tag}".` }] }
        const formatted = rows.map(r =>
          `**[${r.id}]** \`${r.type}\` — **${r.name}** (${r.updated_at.slice(0, 10)})\n${r.body}\n_tags: ${r.tags}_`
        )
        return { content: [{ type: 'text', text: formatted.join('\n\n---\n\n') }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error filtering memories: ${String(e)}` }] }
      }
    }
  )
}
