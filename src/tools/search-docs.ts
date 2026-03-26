import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { embed, getTable } from './utils.js'

export function registerSearchDocsTool(server: McpServer) {
  server.tool(
    'search_docs',
    'Semantic search in documentation (.md .sql .json). Use to find rules, guides, SQL schemas or configuration.',
    {
      query: z.string().describe('What to search for in the documentation'),
      limit: z.number().default(5).describe('Number of results'),
    },
    async ({ query, limit }) => {
      try {
        const vector = await embed(query)
        const table = await getTable('docs')
        const results = await table.search(vector).limit(limit).toArray()
        const formatted = results.map((r: { rel_path: string; text: string }) =>
          `### ${r.rel_path}\n${r.text}`
        )
        return {
          content: [{ type: 'text', text: formatted.join('\n\n---\n\n') || 'No results.' }],
        }
      } catch {
        return { content: [{ type: 'text', text: 'Docs not indexed yet. Run pnpm index:docs' }] }
      }
    }
  )
}
