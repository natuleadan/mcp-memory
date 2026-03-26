import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { embed, getMemoriesTable } from './utils.js'

export function registerBatchSearchMemoriesTool(server: McpServer) {
  server.tool(
    'batch_search_memories',
    'Performs multiple semantic searches in parallel and returns combined results grouped by query. Useful for loading context from several different angles in one call.',
    {
      queries: z
        .string()
        .describe(
          'Queries separated by newlines (max 5), e.g. "git rules\\npnpm usage\\nMCP workflow"'
        ),
      limit_per_query: z.coerce.number().default(3).describe('Max results per query (default: 3)'),
      type: z
        .enum(['soul', 'user', 'feedback', 'project', 'reference', 'pending', 'all'])
        .default('all')
        .describe('Filter by type or "all"'),
    },
    async ({ queries: rawQueries, limit_per_query, type }) => {
      try {
        const table = await getMemoriesTable()
        const queries = rawQueries
          .split('\n')
          .map((q) => q.trim())
          .filter(Boolean)
          .slice(0, 5)
        if (!queries.length) return { content: [{ type: 'text', text: 'No queries provided.' }] }

        const searchResults = await Promise.all(
          queries.map(async (query) => {
            const vector = await embed(query)
            let search = table.search(vector).limit(limit_per_query + 1)
            if (type !== 'all') search = search.where(`type = '${type}'`)
            const rows = (await search.toArray()) as Array<{
              id: string
              type: string
              name: string
              body: string
              updated_at: string
            }>
            return {
              query,
              results: rows
                .filter((r) => r.id !== '__init__')
                .slice(0, limit_per_query)
                .map((r) => ({
                  id: r.id,
                  type: r.type,
                  name: r.name,
                  excerpt:
                    r.body.slice(0, 300).replace(/\n/g, ' ') + (r.body.length > 300 ? '…' : ''),
                  updated_at: r.updated_at.slice(0, 10),
                })),
            }
          })
        )

        const formatted = searchResults.map(({ query, results }) => {
          if (!results.length) return `**"${query}"** → No results`
          const lines = results.map(
            (r) => `  - [${r.id}] \`${r.type}\` **${r.name}** (${r.updated_at})\n    ${r.excerpt}`
          )
          return `**"${query}"** → ${results.length} result(s)\n${lines.join('\n')}`
        })

        return { content: [{ type: 'text', text: formatted.join('\n\n---\n\n') }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error in batch search: ${String(e)}` }] }
      }
    }
  )
}
