import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { countMemories } from '../functions/index.js'
import { memoryTypeAllSchema } from '../types/index.js'

export function registerDataCountTool(server: McpServer) {
  server.tool(
    'data_count',
    'Count total memories in the database, optionally filtered by type.',
    {
      type: memoryTypeAllSchema.optional().describe('Filter by memory type (omit for all)'),
    },
    async ({ type }) => {
      try {
        const result = await countMemories(type)
        return { content: [{ type: 'text', text: `Total: ${result.total}\nReal: ${result.real}\nBy type: ${result.byType}` }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${String(e)}` }] }
      }
    }
  )
}