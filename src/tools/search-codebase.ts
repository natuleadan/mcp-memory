import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { embed, getTable } from './utils.js'

export function registerSearchCodebaseTool(server: McpServer) {
  server.tool(
    'search_codebase',
    'Semantic search in source code (.ts .tsx .js .jsx). Use to find implementations, functions, services, hooks or components.',
    {
      query: z.string().describe('What to search for in the source code'),
      limit: z.number().default(5).describe('Number of results'),
    },
    async ({ query, limit }) => {
      try {
        const vector = await embed(query)
        const table = await getTable('codebase')
        const results = await table.search(vector).limit(limit).toArray()
        const formatted = results.map((r: { rel_path: string; text: string }) =>
          `### ${r.rel_path}\n\`\`\`\n${r.text}\n\`\`\``
        )
        return {
          content: [{ type: 'text', text: formatted.join('\n\n---\n\n') || 'No results.' }],
        }
      } catch {
        return { content: [{ type: 'text', text: 'Codebase not indexed yet. Run pnpm index:code' }] }
      }
    }
  )
}
