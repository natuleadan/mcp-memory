import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMemoryStats } from '../functions/index.js'

export function registerDataStatsTool(server: McpServer) {
  server.tool(
    'data_stats',
    'Returns statistics about the memory system: total count, breakdown by type, oldest/newest entry, and average body length.',
    {},
    async () => {
      try {
        const stats = await getMemoryStats()
        const byType = Object.entries(stats.by_type).map(([t, c]) => `${t}: ${c}`).join(', ')
        return {
          content: [{
            type: 'text',
            text: `Total: ${stats.total}\nBy type: ${byType}\nOldest: ${stats.oldest?.slice(0, 10) ?? 'N/A'}\nNewest: ${stats.newest?.slice(0, 10) ?? 'N/A'}\nAvg body length: ${stats.avg_body_length} chars`,
          }],
        }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${String(e)}` }] }
      }
    }
  )
}