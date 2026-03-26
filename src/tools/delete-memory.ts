import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getMemoriesTable } from './utils.js'

export function registerDeleteMemoryTool(server: McpServer) {
  server.tool(
    'delete_memory',
    'Deletes a memory entry by its id.',
    {
      id: z.string().describe('Memory id to delete'),
    },
    async ({ id }) => {
      try {
        const table = await getMemoriesTable()
        await table.delete(`id = '${id}'`)
        return { content: [{ type: 'text', text: `Memory "${id}" deleted.` }] }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error deleting memory: ${String(e)}` }] }
      }
    }
  )
}
