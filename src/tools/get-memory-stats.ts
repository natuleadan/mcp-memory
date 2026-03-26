import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMemoriesTable } from './utils.js'

export function registerGetMemoryStatsTool(server: McpServer) {
  server.tool(
    'get_memory_stats',
    'Returns statistics about the memory system: total count, breakdown by type, oldest/newest entry, and average body length.',
    {},
    async () => {
      try {
        const table = await getMemoriesTable()
        const rows = (await table.query().where(`id != '__init__'`).toArray()) as Array<{
          id: string
          type: string
          body: string
          updated_at: string
          created_at: string
        }>

        if (!rows.length) return { content: [{ type: 'text', text: 'No memories found.' }] }

        const byType: Record<string, number> = {}
        let totalBodyLen = 0
        let oldest = rows[0].created_at
        let newest = rows[0].created_at

        for (const r of rows) {
          byType[r.type] = (byType[r.type] ?? 0) + 1
          totalBodyLen += r.body.length
          if (r.created_at < oldest) oldest = r.created_at
          if (r.created_at > newest) newest = r.created_at
        }

        const stats = {
          total: rows.length,
          by_type: byType,
          oldest: oldest.slice(0, 10),
          newest: newest.slice(0, 10),
          avg_body_length: Math.round(totalBodyLen / rows.length),
        }

        return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error getting stats: ${String(e)}` }] }
      }
    }
  )
}
