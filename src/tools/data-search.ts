import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { searchData, searchAll } from '../functions/search/data.js'
import { dataSourceSchema, searchModeSchema, memoryTypeAllSchema } from '../types/index.js'

export function registerDataSearchTool(server: McpServer) {
  server.tool(
    'data_search',
    'Unified search across all data sources. Use source param to target specific table, or source="all" for global search across all 4 sources.',
    {
      source: dataSourceSchema.default('memories').describe('Data source: memories, codebase, docs, chatlogs, or all'),
      query: z.string().describe('Search query'),
      limit: z.coerce.number().default(5).describe('Number of results'),
      mode: searchModeSchema.default('critical').describe('Result mode'),
      type: memoryTypeAllSchema.optional().describe('Filter by memory type (only for memories)'),
    },
    async ({ source, query, limit, mode, type }) => {
      try {
        if (source === 'all') {
          const results = await searchAll(query, limit, 'compact')
          return { content: [{ type: 'text', text: results }] }
        }
        const results = await searchData(source, query, limit, mode, type)
        return {
          content: [{ type: 'text', text: results.join('\n\n') || 'No results found.' }],
        }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${String(e)}` }] }
      }
    }
  )
}