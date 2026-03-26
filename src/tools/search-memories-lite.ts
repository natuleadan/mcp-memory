import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { embed, getMemoriesTable } from './utils.js'

export function registerSearchMemoriesLiteTool(server: McpServer) {
  server.tool(
    'search_memories_lite',
    'Semantic search over memories but returns only metadata and a short excerpt (200 chars), not the full body. Use when you need to find relevant memories without loading all content.',
    {
      query: z.string().describe('What to search for in memories'),
      limit: z.coerce.number().default(5).describe('Number of results (default: 5)'),
      type: z
        .enum(['soul', 'user', 'feedback', 'project', 'reference', 'pending', 'all'])
        .default('all')
        .describe('Filter by type or "all"'),
    },
    async ({ query, limit, type }) => {
      try {
        const table = await getMemoriesTable()
        const vector = await embed(query)
        let search = table.search(vector).limit(limit + 1)
        if (type !== 'all') search = search.where(`type = '${type}'`)
        const rows = (await search.toArray()) as Array<{
          id: string
          type: string
          name: string
          body: string
          tags: string
          updated_at: string
        }>
        const filtered = rows.filter((r) => r.id !== '__init__').slice(0, limit)
        if (!filtered.length) return { content: [{ type: 'text', text: 'No memories found.' }] }
        const formatted = filtered.map(
          (r) =>
            `**[${r.id}]** \`${r.type}\` — **${r.name}** (${r.updated_at.slice(0, 10)})\n> ${r.body.slice(0, 200).replace(/\n/g, ' ')}${r.body.length > 200 ? '…' : ''}`
        )
        return { content: [{ type: 'text', text: formatted.join('\n\n') }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error searching memories: ${String(e)}` }] }
      }
    }
  )
}
