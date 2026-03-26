import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getTable } from './utils.js'

export function registerGetRecentChatslogsTool(server: McpServer) {
  server.tool(
    'get_recent_chatlogs',
    'Returns recent chatlog entries in chronological order (newest first). Useful for recovering working memory from recent sessions.',
    {
      days: z.coerce.number().default(7).describe('How many days back to look (default: 7)'),
      limit: z.coerce.number().default(20).describe('Max entries to return (default: 20)'),
    },
    async ({ days, limit }) => {
      try {
        const table = await getTable('chatlogs')
        const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
        const rows = (await table.query().where(`date >= '${cutoff}'`).toArray()) as Array<{
          date: string; rel_path: string; text: string
        }>
        rows.sort((a, b) => b.date.localeCompare(a.date))
        const sliced = rows.slice(0, limit)
        if (!sliced.length) return { content: [{ type: 'text', text: `No chatlogs found in the last ${days} days.` }] }
        const formatted = sliced.map(r => `### ${r.rel_path} (${r.date})\n${r.text}`)
        return { content: [{ type: 'text', text: formatted.join('\n\n---\n\n') }] }
      } catch {
        return { content: [{ type: 'text', text: 'Chatlogs not indexed yet. Run pnpm index:chatlogs' }] }
      }
    }
  )
}
