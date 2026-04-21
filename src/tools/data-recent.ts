import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getRecentMemories } from '../functions/index.js'

export function registerDataRecentTool(server: McpServer) {
  server.tool(
    'data_recent',
    'Returns recent memory entries in chronological order (newest first).',
    {
      days: z.coerce.number().default(7).describe('How many days back to look (default: 7)'),
      limit: z.coerce.number().default(20).describe('Max entries to return (default: 20)'),
    },
    async ({ days, limit }) => {
      try {
        const memories = await getRecentMemories(days, limit)
        const formatted = memories.map(r => `${r.updated_at.slice(0, 10)} - **${r.name}** (\`${r.type}\`)`)
        return { content: [{ type: 'text', text: formatted.join('\n') || 'No recent memories.' }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${String(e)}` }] }
      }
    }
  )
}