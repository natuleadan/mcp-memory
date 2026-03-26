import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { embed, getTable } from './utils.js'

export function registerSearchMemoryTool(server: McpServer) {
  server.tool(
    'search_memory',
    'Semantic search in conversation history/chatlogs.',
    {
      query: z.string().describe('What to search for in the conversation history'),
      limit: z.number().default(5),
    },
    async ({ query, limit }) => {
      try {
        const vector = await embed(query)
        const table = await getTable('chatlogs')
        const results = await table.search(vector).limit(limit).toArray()
        const formatted = results.map((r: { date: string; rel_path: string; text: string }) =>
          `### ${r.rel_path} (${r.date})\n${r.text}`
        )
        return {
          content: [{ type: 'text', text: formatted.join('\n\n---\n\n') || 'No results.' }],
        }
      } catch {
        return { content: [{ type: 'text', text: 'Chatlogs not indexed yet. Run pnpm index:chatlogs' }] }
      }
    }
  )
}
