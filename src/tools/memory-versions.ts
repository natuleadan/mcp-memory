import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getTable } from './utils.js'

export function registerMemoryVersionsTool(server: McpServer) {
  server.tool(
    'memory_versions',
    'Lists all historical versions of a memory by name from the memory_versions table. Useful to track how a rule or project entry evolved over time.',
    {
      name: z.string().describe('Exact name of the memory to inspect history for'),
    },
    async ({ name }) => {
      try {
        const table = await getTable('memory_versions')
        const rows = (await table.query().where(`name = '${name}'`).toArray()) as Array<{
          id: string; version: number; name: string; type: string; body: string; changed_at: string
        }>
        if (!rows.length) {
          return { content: [{ type: 'text', text: `No version history found for memory "${name}".` }] }
        }
        rows.sort((a, b) => b.version - a.version)
        const formatted = rows.map(r =>
          `**v${r.version}** — ${r.changed_at.slice(0, 16)}\n${r.body.slice(0, 400)}${r.body.length > 400 ? '…' : ''}`
        )
        return { content: [{ type: 'text', text: `History for **${name}** (${rows.length} versions):\n\n${formatted.join('\n\n---\n\n')}` }] }
      } catch {
        return { content: [{ type: 'text', text: `No version history available. The memory_versions table does not exist yet — version tracking is recorded automatically when upsert_memory detects a change.` }] }
      }
    }
  )
}
