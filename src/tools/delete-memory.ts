import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getMemoriesTable } from './utils.js'
import { deleteMemoryMd } from './obsidian-vault-client.js'

export function registerDeleteMemoryTool(server: McpServer) {
  server.tool(
    'delete_memory',
    'Deletes a memory entry by its id.',
    {
      id: z.string().describe('Memory id to delete'),
      delete_from_obsidian: z
        .boolean()
        .default(true)
        .describe('Also delete the markdown file from Obsidian vault (default: true)'),
    },
    async ({ id, delete_from_obsidian }) => {
      try {
        const table = await getMemoriesTable()
        // Fetch name+type before deleting to remove MD file
        const rows = await table.query().where(`id = '${id}'`).toArray() as Array<{ type: string; name: string }>
        await table.delete(`id = '${id}'`)
        if (delete_from_obsidian && rows.length) {
          deleteMemoryMd(rows[0].type, rows[0].name)
        }
        return { content: [{ type: 'text', text: `Memory "${id}" deleted.` }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error deleting memory: ${String(e)}` }] }
      }
    }
  )
}
