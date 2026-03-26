import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getMemoriesTable } from './utils.js'

export function registerGetMemoryByNameTool(server: McpServer) {
  server.tool(
    'get_memory_by_name',
    'Direct O(1) lookup of a memory by its exact name. Faster than semantic search when you know the name. Returns a single memory entry.',
    {
      name: z.string().describe('Exact name of the memory to retrieve (e.g. "leo_profile")'),
    },
    async ({ name }) => {
      try {
        const table = await getMemoriesTable()
        const rows = (await table.query().where(`name = '${name}'`).toArray()) as Array<{
          id: string
          type: string
          name: string
          body: string
          tags: string
          updated_at: string
          created_at: string
        }>
        if (!rows.length)
          return { content: [{ type: 'text', text: `No memory found with name "${name}".` }] }
        const r = rows[0]
        const formatted = `**[${r.id}]** \`${r.type}\` — **${r.name}** (updated: ${r.updated_at.slice(0, 10)})\n\n${r.body}${r.tags ? `\n\n_tags: ${r.tags}_` : ''}`
        return { content: [{ type: 'text', text: formatted }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error fetching memory: ${String(e)}` }] }
      }
    }
  )
}
